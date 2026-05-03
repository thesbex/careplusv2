package ma.careplus.identity.application;

import java.util.UUID;

public record LoginResult(
        String accessToken,
        String rawRefreshToken,
        long expiresInSeconds,
        UUID userId,
        String email,
        String firstName,
        String lastName,
        java.util.Set<String> roles
) {}
