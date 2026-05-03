package ma.careplus.identity.infrastructure.web.dto;

public record LoginResponse(
        String accessToken,
        long expiresInSeconds,
        UserView user
) {}
