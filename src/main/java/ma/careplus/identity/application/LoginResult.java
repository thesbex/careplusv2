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
        java.util.Set<String> roles,
        /** V044 — TRUE if the admin reset the password ; the client must redirect to /force-change-password. */
        boolean passwordChangeRequired
) {}
