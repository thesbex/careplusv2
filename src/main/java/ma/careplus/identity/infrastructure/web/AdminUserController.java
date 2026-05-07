package ma.careplus.identity.infrastructure.web;

import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.identity.application.PractitionerService;
import ma.careplus.identity.infrastructure.web.dto.AdminUserView;
import ma.careplus.identity.infrastructure.web.dto.CreateUserRequest;
import ma.careplus.identity.infrastructure.web.dto.UpdateUserRequest;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import ma.careplus.shared.error.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only user CRUD endpoint.
 *
 * <p>Requires a JWT with the ADMIN role. Creates a user with the requested
 * role codes (validated against identity_role.code) and a BCrypt-hashed
 * password (strength 12, same encoder as AuthService).
 *
 * <p>V032 — adds practitioner-assignment plumbing:
 * <ul>
 *   <li>POST: when creating a SECRETAIRE/ASSISTANT, the optional
 *       {@code assignedPractitionerIds} field is honored ({@code null} =
 *       auto-assign all active practitioners; {@code []} = none;
 *       {@code [...]} = exactly that set). Ignored for MEDECIN/ADMIN-only users.</li>
 *   <li>PUT: same field, with the additional rule that an absent field leaves
 *       existing assignments untouched (partial update semantics).</li>
 *   <li>GET {id}: exposes the current assignment list so the frontend admin
 *       form can pre-populate the practitioner picker.</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private static final Logger log = LoggerFactory.getLogger(AdminUserController.class);

    private static final Set<String> ALLOWED_ROLE_CODES =
            Set.of("SECRETAIRE", "ASSISTANT", "MEDECIN", "ADMIN");

    /** Roles that require/accept practitioner assignments. */
    private static final Set<String> ASSISTANT_ROLES = Set.of("SECRETAIRE", "ASSISTANT");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final PractitionerService practitionerService;

    public AdminUserController(JdbcTemplate jdbc, PasswordEncoder passwordEncoder,
                               PractitionerService practitionerService) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.practitionerService = practitionerService;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public List<AdminUserView> listUsers() {
        // Single query with users + role codes via array_agg, ordered by name.
        // LEFT JOIN so users without any role still appear (defensive).
        String sql = """
                SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.enabled,
                       COALESCE(array_agg(r.code) FILTER (WHERE r.code IS NOT NULL), '{}'::text[]) AS roles
                  FROM identity_user u
             LEFT JOIN identity_user_role ur ON ur.user_id = u.id
             LEFT JOIN identity_role r       ON r.id = ur.role_id
              GROUP BY u.id
              ORDER BY u.last_name, u.first_name
                """;
        return jdbc.query(sql, (rs, i) -> {
            String[] roles = (String[]) rs.getArray("roles").getArray();
            return new AdminUserView(
                    (UUID) rs.getObject("id"),
                    rs.getString("email"),
                    rs.getString("first_name"),
                    rs.getString("last_name"),
                    rs.getString("phone"),
                    rs.getBoolean("enabled"),
                    List.of(roles));
        });
    }

    /**
     * GET /api/admin/users/{id} — full view of a single user including
     * practitioner assignments. Used by the admin "edit user" form to
     * pre-populate fields without a second round-trip.
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public UserView getUser(@PathVariable UUID id) {
        Set<String> roles;
        String email;
        String firstName;
        String lastName;
        try {
            var row = jdbc.queryForObject(
                    "SELECT email, first_name, last_name FROM identity_user WHERE id = ?",
                    (rs, i) -> new String[] {
                            rs.getString("email"),
                            rs.getString("first_name"),
                            rs.getString("last_name")
                    }, id);
            email = row[0];
            firstName = row[1];
            lastName = row[2];
        } catch (EmptyResultDataAccessException e) {
            throw new BusinessException("USER_NOT_FOUND", "Utilisateur introuvable.",
                    HttpStatus.NOT_FOUND.value());
        }
        List<String> roleCodes = jdbc.queryForList(
                "SELECT r.code FROM identity_role r "
                        + "JOIN identity_user_role ur ON ur.role_id = r.id "
                        + "WHERE ur.user_id = ?",
                String.class, id);
        roles = Set.copyOf(roleCodes);
        List<UUID> assignedPractitionerIds = practitionerService.assignmentsFor(id);
        return new UserView(id, email, firstName, lastName, roles,
                Collections.emptySet(), assignedPractitionerIds);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Void> deactivateUser(@PathVariable UUID id) {
        // Soft-disable: flip the enabled flag rather than DELETE. Users own
        // historical data (audit logs, consultations) so hard-deletion would
        // break referential integrity. Disabled users can no longer log in
        // (handled by AuthService) but their past actions remain attributable.
        int updated = jdbc.update(
                "UPDATE identity_user SET enabled = FALSE, updated_at = now() WHERE id = ? AND enabled = TRUE",
                id);
        if (updated == 0) {
            throw new BusinessException(
                    "USER_NOT_FOUND_OR_ALREADY_DISABLED",
                    "Utilisateur introuvable ou déjà désactivé.",
                    HttpStatus.NOT_FOUND.value());
        }
        // Revoke all live refresh tokens so the disabled session can't survive.
        jdbc.update(
                "UPDATE identity_refresh_token SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL",
                id);
        log.info("Admin disabled user {}", id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<UserView> createUser(@Valid @RequestBody CreateUserRequest req) {
        // Validate role codes before touching the DB so we 400 cleanly on typos.
        Set<String> normalized = req.roles().stream()
                .map(String::trim)
                .map(String::toUpperCase)
                .collect(Collectors.toUnmodifiableSet());
        Set<String> invalid = normalized.stream()
                .filter(r -> !ALLOWED_ROLE_CODES.contains(r))
                .collect(Collectors.toUnmodifiableSet());
        if (!invalid.isEmpty()) {
            throw new BusinessException(
                    "INVALID_ROLE",
                    "Rôles inconnus : " + invalid + ". Autorisés : " + ALLOWED_ROLE_CODES,
                    HttpStatus.BAD_REQUEST.value());
        }

        // Uniqueness — fast pre-check; the unique index is the real guard.
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user WHERE LOWER(email) = LOWER(?)",
                Integer.class, req.email());
        if (existing != null && existing > 0) {
            throw new BusinessException(
                    "EMAIL_ALREADY_EXISTS",
                    "Un utilisateur avec cet email existe déjà.",
                    HttpStatus.CONFLICT.value());
        }

        UUID userId = UUID.randomUUID();
        String hash = passwordEncoder.encode(req.password());
        OffsetDateTime now = OffsetDateTime.now();

        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, phone, specialty, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                userId, req.email(), hash, req.firstName(), req.lastName(), req.phone(),
                blankToNull(req.specialty()), now, now);

        // Resolve role codes → role UUIDs. IN (?, ?, ...) with dynamic placeholders
        // — more portable than Postgres ANY(?) + Java String[] which depends on
        // pgjdbc-specific array binding that varies across driver versions.
        // Safe: placeholders are generated from COUNT only, never from user input.
        String placeholders = String.join(",", Collections.nCopies(normalized.size(), "?"));
        List<UUID> roleIds = jdbc.query(
                "SELECT id FROM identity_role WHERE code IN (" + placeholders + ")",
                (rs, i) -> (UUID) rs.getObject("id"),
                normalized.toArray());

        for (UUID roleId : roleIds) {
            jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                    userId, roleId);
        }

        // V032 — practitioner assignments (SECRETAIRE / ASSISTANT only).
        List<UUID> assignedIds = applyAssignmentsOnCreate(userId, normalized,
                req.assignedPractitionerIds());

        log.info("Admin created user {} ({}) with roles {} and {} assignment(s)",
                req.email(), userId, normalized, assignedIds.size());

        UserView body = new UserView(
                userId,
                req.email(),
                req.firstName(),
                req.lastName(),
                normalized,
                Collections.emptySet(),
                assignedIds);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public UserView updateUser(@PathVariable UUID id, @RequestBody UpdateUserRequest req) {
        // Verify the user exists first — 404 cleanly rather than letting a 0-row
        // UPDATE return a stale view.
        String[] current;
        try {
            current = jdbc.queryForObject(
                    "SELECT email, first_name, last_name, phone, specialty FROM identity_user WHERE id = ?",
                    (rs, i) -> new String[] {
                            rs.getString("email"),
                            rs.getString("first_name"),
                            rs.getString("last_name"),
                            rs.getString("phone"),
                            rs.getString("specialty"),
                    }, id);
        } catch (EmptyResultDataAccessException e) {
            throw new BusinessException("USER_NOT_FOUND", "Utilisateur introuvable.",
                    HttpStatus.NOT_FOUND.value());
        }

        String email = optStr(req.email()).orElse(current[0]);
        String firstName = optStr(req.firstName()).orElse(current[1]);
        String lastName = optStr(req.lastName()).orElse(current[2]);
        String phone = req.phone() == null ? current[3] : req.phone().orElse(null);
        String specialty = req.specialty() == null ? current[4]
                : req.specialty().map(AdminUserController::blankToNull).orElse(null);

        // Email uniqueness if changed
        if (req.email() != null && req.email().isPresent() && !email.equalsIgnoreCase(current[0])) {
            Integer dup = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM identity_user WHERE LOWER(email) = LOWER(?) AND id <> ?",
                    Integer.class, email, id);
            if (dup != null && dup > 0) {
                throw new BusinessException("EMAIL_ALREADY_EXISTS",
                        "Un utilisateur avec cet email existe déjà.",
                        HttpStatus.CONFLICT.value());
            }
        }

        jdbc.update(
                "UPDATE identity_user SET email = ?, first_name = ?, last_name = ?, "
                        + "phone = ?, specialty = ?, updated_at = now() WHERE id = ?",
                email, firstName, lastName, phone, specialty, id);

        // Enabled flag (separate column update so we don't tangle with the row above)
        if (req.enabled() != null && req.enabled().isPresent()) {
            jdbc.update("UPDATE identity_user SET enabled = ?, updated_at = now() WHERE id = ?",
                    req.enabled().get(), id);
        }

        // Roles — replace exact set if provided
        Set<String> finalRoles;
        if (req.roles() != null && req.roles().isPresent()) {
            Set<String> normalized = req.roles().get().stream()
                    .map(String::trim)
                    .map(String::toUpperCase)
                    .collect(Collectors.toUnmodifiableSet());
            Set<String> invalid = normalized.stream()
                    .filter(r -> !ALLOWED_ROLE_CODES.contains(r))
                    .collect(Collectors.toUnmodifiableSet());
            if (!invalid.isEmpty()) {
                throw new BusinessException("INVALID_ROLE",
                        "Rôles inconnus : " + invalid + ". Autorisés : " + ALLOWED_ROLE_CODES,
                        HttpStatus.BAD_REQUEST.value());
            }
            jdbc.update("DELETE FROM identity_user_role WHERE user_id = ?", id);
            String placeholders = String.join(",", Collections.nCopies(normalized.size(), "?"));
            List<UUID> roleIds = jdbc.query(
                    "SELECT id FROM identity_role WHERE code IN (" + placeholders + ")",
                    (rs, i) -> (UUID) rs.getObject("id"),
                    normalized.toArray());
            for (UUID roleId : roleIds) {
                jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                        id, roleId);
            }
            finalRoles = normalized;
        } else {
            finalRoles = currentRolesFor(id);
        }

        // V032 — assignments
        List<UUID> assignedIds = applyAssignmentsOnUpdate(id, finalRoles,
                req.assignedPractitionerIds());

        log.info("Admin updated user {} (roles={}, assignments={})", id, finalRoles, assignedIds.size());

        return new UserView(id, email, firstName, lastName, finalRoles,
                Collections.emptySet(), assignedIds);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private List<UUID> applyAssignmentsOnCreate(UUID userId, Set<String> roles,
                                                Optional<List<UUID>> requested) {
        if (!hasAssistantRole(roles)) {
            // MEDECIN/ADMIN-only — silently ignore the field.
            return Collections.emptyList();
        }
        if (requested == null || requested.isEmpty()) {
            // Field absent or explicit JSON null → auto-assign default.
            practitionerService.autoAssignToAllActivePractitioners(userId);
        } else {
            // Explicit list (possibly empty)
            List<UUID> ids = requested.get();
            validatePractitionerIdsExist(ids);
            practitionerService.replaceAssignments(userId, ids);
        }
        return practitionerService.assignmentsFor(userId);
    }

    private List<UUID> applyAssignmentsOnUpdate(UUID userId, Set<String> roles,
                                                Optional<List<UUID>> requested) {
        boolean hasAssistantRole = hasAssistantRole(roles);
        boolean fieldProvided = requested != null && requested.isPresent();
        if (fieldProvided) {
            // Honor caller exact intent — even for non-assistant roles we wipe
            // the (no-longer-applicable) rows to keep the table coherent.
            List<UUID> ids = requested.get();
            if (!hasAssistantRole) {
                practitionerService.replaceAssignments(userId, Collections.emptyList());
            } else {
                validatePractitionerIdsExist(ids);
                practitionerService.replaceAssignments(userId, ids);
            }
        } else if (hasAssistantRole) {
            // Field absent. If the user transitioned INTO an assistant role and
            // currently has no assignments, auto-assign as a sensible default.
            List<UUID> existing = practitionerService.assignmentsFor(userId);
            if (existing.isEmpty()) {
                practitionerService.autoAssignToAllActivePractitioners(userId);
            }
        } else {
            // Non-assistant role + field absent → clear any stale rows so a former
            // SECRETAIRE who is now MEDECIN-only doesn't keep ghost assignments.
            practitionerService.replaceAssignments(userId, Collections.emptyList());
        }
        return practitionerService.assignmentsFor(userId);
    }

    private void validatePractitionerIdsExist(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return;
        // Reject ids that aren't enabled MEDECIN users — keeps the assignment
        // table referentially clean and surfaces typos at API time, not at
        // first agenda-load time.
        String placeholders = String.join(",", Collections.nCopies(ids.size(), "?"));
        List<UUID> valid = jdbc.query(
                "SELECT u.id FROM identity_user u "
                        + "JOIN identity_user_role ur ON ur.user_id = u.id "
                        + "JOIN identity_role r ON r.id = ur.role_id "
                        + "WHERE r.code = 'MEDECIN' AND u.enabled = TRUE "
                        + "  AND u.id IN (" + placeholders + ")",
                (rs, i) -> (UUID) rs.getObject("id"),
                ids.toArray());
        if (valid.size() != ids.stream().distinct().count()) {
            throw new BusinessException("INVALID_PRACTITIONER",
                    "Un ou plusieurs identifiants de médecin sont inconnus ou inactifs.",
                    HttpStatus.BAD_REQUEST.value());
        }
    }

    private Set<String> currentRolesFor(UUID userId) {
        return Set.copyOf(jdbc.queryForList(
                "SELECT r.code FROM identity_role r "
                        + "JOIN identity_user_role ur ON ur.role_id = r.id "
                        + "WHERE ur.user_id = ?",
                String.class, userId));
    }

    private static boolean hasAssistantRole(Set<String> roles) {
        return roles.stream().anyMatch(ASSISTANT_ROLES::contains);
    }

    private static Optional<String> optStr(Optional<String> opt) {
        return opt == null ? Optional.empty() : opt;
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
