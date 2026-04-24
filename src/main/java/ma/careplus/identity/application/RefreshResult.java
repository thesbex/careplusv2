package ma.careplus.identity.application;

public record RefreshResult(
        String accessToken,
        String rawRefreshToken,
        long expiresInSeconds
) {}
