package ma.careplus.identity.application;

import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.shared.error.BusinessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cabinet-wide practitioner-scoping rules (V032 strict isolation).
 *
 * <p>Returns the set of practitioner ids the caller is allowed to act on, or
 * {@link Optional#empty()} for "no scope = full access". Empty optional is
 * the conscious tri-state choice : an empty {@code Set} would mean "no
 * practitioner", which is a valid restrictive scope and a different signal.
 *
 * <p>Effective rule (server-side authoritative — the toggle in /parametres
 * is just the same flag exposed to the UI):
 * <ol>
 *   <li>ADMIN → no scope (provisioning needs the full roster).</li>
 *   <li>{@code agenda_strict_isolation = FALSE} → no scope (open by default,
 *       matches the 2026-05-07 multi-praticien decision).</li>
 *   <li>Cabinet with a single active MEDECIN → no scope.</li>
 *   <li>MEDECIN with isolation ON → scope = {self}.</li>
 *   <li>SECRETAIRE / ASSISTANT with isolation ON → scope =
 *       {@link PractitionerService#assignmentsFor(UUID)}.</li>
 * </ol>
 */
@Service
public class AccessScopeService {

    private final JdbcTemplate jdbc;
    private final PractitionerService practitionerService;

    public AccessScopeService(JdbcTemplate jdbc, PractitionerService practitionerService) {
        this.jdbc = jdbc;
        this.practitionerService = practitionerService;
    }

    @Transactional(readOnly = true)
    public Optional<Set<UUID>> allowedPractitioners(UUID userId, Collection<String> roles) {
        if (userId == null || roles == null) return Optional.empty();
        if (roles.contains("ADMIN")) return Optional.empty();
        if (!isStrictIsolationOn()) return Optional.empty();
        if (countActivePractitioners() < 2) return Optional.empty();

        if (roles.contains("MEDECIN")) {
            return Optional.of(Set.of(userId));
        }
        if (roles.contains("SECRETAIRE") || roles.contains("ASSISTANT")) {
            return Optional.of(new HashSet<>(practitionerService.assignmentsFor(userId)));
        }
        // Unknown role under isolation → lock down rather than leak.
        return Optional.of(Collections.emptySet());
    }

    public Optional<Set<UUID>> allowedPractitioners(Authentication auth) {
        if (auth == null) return Optional.empty();
        UUID userId;
        try {
            userId = UUID.fromString(auth.getName());
        } catch (IllegalArgumentException e) {
            return Optional.empty();
        }
        Set<String> roles = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a)
                .collect(Collectors.toUnmodifiableSet());
        return allowedPractitioners(userId, roles);
    }

    public boolean canAccess(Authentication auth, UUID practitionerId) {
        Optional<Set<UUID>> scope = allowedPractitioners(auth);
        return scope.isEmpty() || (practitionerId != null && scope.get().contains(practitionerId));
    }

    public void requireAccess(Authentication auth, UUID practitionerId) {
        if (!canAccess(auth, practitionerId)) {
            throw new BusinessException(
                    "FORBIDDEN_PRACTITIONER",
                    "Vous n'êtes pas autorisé à accéder à cet agenda.",
                    HttpStatus.FORBIDDEN.value());
        }
    }

    private boolean isStrictIsolationOn() {
        try {
            Boolean b = jdbc.queryForObject(
                    "SELECT agenda_strict_isolation FROM configuration_clinic_settings LIMIT 1",
                    Boolean.class);
            return Boolean.TRUE.equals(b);
        } catch (EmptyResultDataAccessException e) {
            return false;
        }
    }

    private int countActivePractitioners() {
        Integer c = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user u "
                        + "JOIN identity_user_role ur ON ur.user_id = u.id "
                        + "JOIN identity_role r ON r.id = ur.role_id "
                        + "WHERE r.code = 'MEDECIN' AND u.enabled = TRUE",
                Integer.class);
        return c == null ? 0 : c;
    }
}
