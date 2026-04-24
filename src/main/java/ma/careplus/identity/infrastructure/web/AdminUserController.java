package ma.careplus.identity.infrastructure.web;

import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.identity.infrastructure.web.dto.CreateUserRequest;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import ma.careplus.shared.error.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin-only user creation endpoint.
 *
 * Requires a JWT with the ADMIN role. Creates a user with the requested role
 * codes (validated against identity_role.code) and a BCrypt-hashed password
 * (strength 12, same encoder as AuthService).
 *
 * Problem solved: without this, adding a new user on a running instance
 * required either (a) restarting with the `dev` profile so DevUserSeeder
 * re-runs, or (b) hand-crafted SQL INSERTs with a pre-computed BCrypt hash.
 * Both are operational hazards. This is the intended day-2 path for all
 * future user provisioning — including future cabinet installs.
 */
@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private static final Logger log = LoggerFactory.getLogger(AdminUserController.class);

    private static final Set<String> ALLOWED_ROLE_CODES =
            Set.of("SECRETAIRE", "ASSISTANT", "MEDECIN", "ADMIN");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public AdminUserController(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
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
                    (id, email, password_hash, first_name, last_name, phone, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                userId, req.email(), hash, req.firstName(), req.lastName(), req.phone(), now, now);

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

        log.info("Admin created user {} ({}) with roles {}", req.email(), userId, normalized);

        UserView body = new UserView(
                userId,
                req.email(),
                req.firstName(),
                req.lastName(),
                normalized);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
