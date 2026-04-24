package ma.careplus.identity.infrastructure.web.dto;

public record RefreshResponse(
        String accessToken,
        long expiresInSeconds
) {}
