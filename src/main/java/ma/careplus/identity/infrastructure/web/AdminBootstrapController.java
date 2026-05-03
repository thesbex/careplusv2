package ma.careplus.identity.infrastructure.web;

import jakarta.validation.Valid;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.identity.infrastructure.web.dto.BootstrapRequest;
import ma.careplus.identity.infrastructure.web.dto.BootstrapResponse;
import ma.careplus.shared.error.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * One-shot admin bootstrap for fresh cloud deployments.
 *
 * Problem solved: `DevUserSeeder` is `@Profile("dev")` only. Cloud staging runs
 * `prod-cloud` profile → no users → login impossible. Rather than leak dev
 * seeding into prod-cloud, this endpoint creates the first admin **only when
 * the users table is empty**. After that, it refuses all subsequent calls.
 *
 * Safety model:
 *   - Empty-DB precondition is the primary guard — once any user exists, 409.
 *   - Endpoint is permit-listed in SecurityConfig so an unauthenticated caller
 *     on a brand-new deployment can set up their first admin.
 *   - Transaction uses SERIALIZABLE isolation so two concurrent callers can't
 *     both pass the empty-check and both create an admin.
 *   - No race after first success: second and later attempts all return 409.
 *   - Audit trail: every attempt is logged.
 *   - Future hardening (post-MVP): require a one-shot `CAREPLUS_BOOTSTRAP_TOKEN`
 *     env-var header match to defeat the narrow race between deploy and first
 *     legitimate bootstrap. Not worth it today — the window is <1 min and the
 *     URL isn't advertised.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminBootstrapController {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrapController.class);

    /** V002 seeds this role; see `src/main/resources/db/migration/V002__reference_data.sql`. */
    private static final UUID ROLE_ADMIN = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public AdminBootstrapController(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @PostMapping("/bootstrap")
    @Transactional(isolation = org.springframework.transaction.annotation.Isolation.SERIALIZABLE)
    public ResponseEntity<BootstrapResponse> bootstrap(@Valid @RequestBody BootstrapRequest req) {
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user", Integer.class);
        if (existing != null && existing > 0) {
            log.warn("Bootstrap attempted but database already has {} user(s) — rejecting", existing);
            throw new BusinessException(
                    "BOOTSTRAP_LOCKED",
                    "La base contient déjà au moins un utilisateur. L'endpoint bootstrap est verrouillé.",
                    HttpStatus.CONFLICT.value());
        }

        UUID userId = UUID.randomUUID();
        String hash = passwordEncoder.encode(req.password());
        OffsetDateTime now = OffsetDateTime.now();

        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                userId, req.email(), hash, req.firstName(), req.lastName(), now, now);

        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)",
                userId, ROLE_ADMIN);

        log.info("Bootstrap admin created: {} ({})", req.email(), userId);

        BootstrapResponse body = new BootstrapResponse(userId, req.email(), List.of("ADMIN"));
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
