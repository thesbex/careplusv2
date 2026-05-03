package ma.careplus.pregnancy.application;

import java.util.List;
import java.util.UUID;

/**
 * Builds a pre-filled prescription template for the T1/T2/T3 bio panel.
 *
 * <p>Per design doc Q8 and Min Santé Maroc PSGA programme.
 * The frontend uses the returned {@link BioPanelTemplate} to pre-populate
 * the PrescriptionDrawer — the physician then reviews and adjusts before validating.
 */
public interface PregnancyBioPanelService {

    /**
     * A single test line in the bio panel template.
     *
     * @param catalogCode lab test code from {@code catalog_lab_test} (nullable if not found)
     * @param label       human-readable French label
     * @param prescription free-text prescription fallback when catalogCode is null
     */
    record BioPanelLine(String catalogCode, String label, String prescription) {}

    /**
     * The full template for a given trimester.
     *
     * @param pregnancyId target pregnancy id (for context — not used internally in v1)
     * @param trimester   T1, T2, or T3
     * @param lines       ordered list of tests to prescribe
     */
    record BioPanelTemplate(UUID pregnancyId, String trimester, List<BioPanelLine> lines) {}

    /**
     * Returns a pre-filled template for the given trimester.
     *
     * @param pregnancyId the pregnancy context
     * @param trimester   T1 | T2 | T3
     * @param actorId     authenticated user (for audit; not stored in v1)
     * @return fully populated template
     * @throws ma.careplus.shared.error.BusinessException with code INVALID_TRIMESTER if
     *         trimester is not T1, T2 or T3
     */
    BioPanelTemplate buildTemplate(UUID pregnancyId, String trimester, UUID actorId);
}
