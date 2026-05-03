package ma.careplus.patient.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;

public record CreatePatientNoteRequest(
        @NotBlank String content
) {}
