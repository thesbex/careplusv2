package ma.careplus.identity.application;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.UUID;
import ma.careplus.identity.domain.RefreshToken;
import ma.careplus.identity.infrastructure.persistence.RefreshTokenRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RefreshTokenService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtProperties jwtProperties;

    public RefreshTokenService(RefreshTokenRepository refreshTokenRepository,
                               JwtProperties jwtProperties) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtProperties = jwtProperties;
    }

    @Transactional
    public String createToken(UUID userId, String userAgent, String ip) {
        String rawToken = generateRaw();
        String hash = sha256Hex(rawToken);

        OffsetDateTime now = OffsetDateTime.now();
        RefreshToken token = new RefreshToken(
                UUID.randomUUID(),
                userId,
                hash,
                now,
                now.plusDays(jwtProperties.getRefreshTokenTtlDays()),
                userAgent,
                ip
        );
        refreshTokenRepository.save(token);
        return rawToken;
    }

    /**
     * Rotates the token: revokes old one, creates new one, returns both entity and raw value.
     */
    @Transactional
    public RotateResult rotateToken(String rawToken, String userAgent, String ip) {
        String hash = sha256Hex(rawToken);
        RefreshToken existing = refreshTokenRepository.findByTokenHash(hash)
                .orElseThrow(() -> new InvalidTokenException("Refresh token not found"));

        if (!existing.isActive()) {
            // Possible token reuse — revoke all for user as security measure
            refreshTokenRepository.revokeAllForUser(existing.getUserId());
            throw new InvalidTokenException("Refresh token is revoked or expired");
        }

        existing.setRevokedAt(OffsetDateTime.now());

        String newRawToken = generateRaw();
        String newHash = sha256Hex(newRawToken);

        OffsetDateTime now = OffsetDateTime.now();
        RefreshToken newToken = new RefreshToken(
                UUID.randomUUID(),
                existing.getUserId(),
                newHash,
                now,
                now.plusDays(jwtProperties.getRefreshTokenTtlDays()),
                userAgent,
                ip
        );
        existing.setReplacedBy(newToken.getId());
        refreshTokenRepository.save(existing);
        refreshTokenRepository.save(newToken);

        return new RotateResult(newToken, newRawToken);
    }

    @Transactional
    public void revokeToken(String rawToken) {
        String hash = sha256Hex(rawToken);
        refreshTokenRepository.findByTokenHash(hash).ifPresent(t -> {
            if (t.getRevokedAt() == null) {
                t.setRevokedAt(OffsetDateTime.now());
                refreshTokenRepository.save(t);
            }
        });
    }

    public long refreshTtlSeconds() {
        return jwtProperties.getRefreshTokenTtlDays() * 86400;
    }

    private String generateRaw() {
        byte[] raw = new byte[64]; // 512 bits
        SECURE_RANDOM.nextBytes(raw);
        return HexFormat.of().formatHex(raw);
    }

    static String sha256Hex(String input) {
        try {
            var md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
