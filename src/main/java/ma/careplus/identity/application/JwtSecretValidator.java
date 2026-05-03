package ma.careplus.identity.application;

import jakarta.annotation.PostConstruct;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Refuse to start when the JWT secret is missing, too short for HS256,
 * or still the placeholder default in any non-dev/non-test profile.
 *
 * HS256 requires the key to be at least the size of the hash output
 * (32 bytes / 256 bits) — anything shorter is rejected by Nimbus at runtime,
 * but we want a clear startup error instead of a 500 on the first /login.
 */
@Component
public class JwtSecretValidator {

    private static final Logger log = LoggerFactory.getLogger(JwtSecretValidator.class);

    private static final int MIN_SECRET_BYTES = 32;
    private static final Set<String> DEV_PROFILES = Set.of("dev", "test");
    private static final Set<String> KNOWN_PLACEHOLDERS = Set.of(
            "change-me-in-prod-change-me-in-prod-change-me",
            "change-me-in-prod");

    private final JwtProperties props;
    private final Environment env;

    public JwtSecretValidator(JwtProperties props, Environment env) {
        this.props = props;
        this.env = env;
    }

    @PostConstruct
    void validate() {
        String secret = props.getSecret();
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "careplus.security.jwt.secret is missing. Set CAREPLUS_JWT_SECRET to a value of at least "
                            + MIN_SECRET_BYTES + " bytes.");
        }

        int length = secret.getBytes(StandardCharsets.UTF_8).length;
        if (length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "careplus.security.jwt.secret is too short ("
                            + length + " bytes). HS256 requires at least " + MIN_SECRET_BYTES + " bytes.");
        }

        boolean isPlaceholder = KNOWN_PLACEHOLDERS.contains(secret);
        if (!isPlaceholder) return;

        boolean inDevOrTest = false;
        for (String active : env.getActiveProfiles()) {
            if (DEV_PROFILES.contains(active)) {
                inDevOrTest = true;
                break;
            }
        }
        if (!inDevOrTest) {
            throw new IllegalStateException(
                    "careplus.security.jwt.secret is still the placeholder default. "
                            + "Set CAREPLUS_JWT_SECRET to a strong, random value before starting in profile "
                            + String.join(",", env.getActiveProfiles()) + ".");
        }
        log.warn("JWT secret is the placeholder default. Acceptable in profile {} only.",
                String.join(",", env.getActiveProfiles()));
    }
}
