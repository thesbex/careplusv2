package ma.careplus.shared.bootstrap;

import java.time.OffsetDateTime;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the 3 dev users on the 'dev' profile if they don't exist yet.
 * Uses JdbcTemplate directly because identity module entities don't exist in J1.
 * They will be replaced by the real UserService in J2, and this seeder stays idempotent.
 */
@Component
@Profile("dev")
public class DevUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevUserSeeder.class);

    private static final String DEFAULT_PASSWORD = "ChangeMe123!";

    // Role UUIDs match V002__reference_data.sql
    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_ASSISTANT  = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ROLE_ADMIN      = UUID.fromString("00000000-0000-0000-0000-000000000004");

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;

    public DevUserSeeder(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        seedUser("youssef.elamrani@careplus.ma", "Youssef",       "El Amrani", "+212 6 00 00 00 01",
                new UUID[]{ROLE_MEDECIN, ROLE_ADMIN});
        seedUser("fatima.zahra@careplus.ma",      "Fatima Zahra", "Benjelloun", "+212 6 00 00 00 02",
                new UUID[]{ROLE_SECRETAIRE});
        seedUser("khadija.bennis@careplus.ma",    "Khadija",      "Bennis",    "+212 6 00 00 00 03",
                new UUID[]{ROLE_ASSISTANT});
    }

    private void seedUser(String email, String firstName, String lastName, String phone, UUID[] roleIds) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user WHERE email = ?", Integer.class, email);
        if (count != null && count > 0) {
            return;
        }
        UUID userId = UUID.randomUUID();
        String hash = passwordEncoder.encode(DEFAULT_PASSWORD);
        jdbc.update("""
                INSERT INTO identity_user
                    (id, email, password_hash, first_name, last_name, phone, enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, TRUE, 0, 0, ?, ?)
                """,
                userId, email, hash, firstName, lastName, phone, OffsetDateTime.now(), OffsetDateTime.now());
        for (UUID roleId : roleIds) {
            jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", userId, roleId);
        }
        log.info("Seeded dev user {} with roles {}", email, (Object) roleIds);
    }
}
