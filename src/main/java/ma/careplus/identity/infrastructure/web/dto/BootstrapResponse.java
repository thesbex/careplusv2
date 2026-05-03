package ma.careplus.identity.infrastructure.web.dto;

import java.util.List;
import java.util.UUID;

/** Response for POST /api/admin/bootstrap. */
public record BootstrapResponse(
        UUID id,
        String email,
        List<String> roles
) {}
