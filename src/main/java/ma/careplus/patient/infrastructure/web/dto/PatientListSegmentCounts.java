package ma.careplus.patient.infrastructure.web.dto;

/**
 * Pre-aggregated counts for the segmented control on the patients list (05a).
 * Read-only snapshot — the frontend uses them for the chip badges and never
 * decrements them client-side.
 */
public record PatientListSegmentCounts(
        long tous,
        long recent,
        long chroniques,
        long nouveaux
) {}
