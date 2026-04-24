package ma.careplus.identity.infrastructure.web.dto;

import java.util.Set;
import java.util.UUID;

public record UserView(
        UUID id,
        String email,
        String firstName,
        String lastName,
        Set<String> roles
) {}
