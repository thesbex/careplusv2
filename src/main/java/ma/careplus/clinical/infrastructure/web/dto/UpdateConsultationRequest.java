package ma.careplus.clinical.infrastructure.web.dto;

/** Partial update — all fields optional; nulls preserve existing values. */
public record UpdateConsultationRequest(
        String motif,
        String examination,
        String diagnosis,
        String notes
) {}
