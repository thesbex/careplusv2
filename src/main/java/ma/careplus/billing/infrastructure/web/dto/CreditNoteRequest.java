package ma.careplus.billing.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;

public record CreditNoteRequest(
        @NotBlank String reason
) {}
