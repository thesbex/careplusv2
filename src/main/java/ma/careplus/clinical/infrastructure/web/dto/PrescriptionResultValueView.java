package ma.careplus.clinical.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.clinical.domain.PrescriptionResultValue;

public record PrescriptionResultValueView(
        UUID id,
        UUID prescriptionLineId,
        String analyte,
        BigDecimal value,
        String unit,
        OffsetDateTime recordedAt,
        int sortOrder
) {
    public static PrescriptionResultValueView of(PrescriptionResultValue v) {
        return new PrescriptionResultValueView(
                v.getId(),
                v.getPrescriptionLineId(),
                v.getAnalyte(),
                v.getValueNumeric(),
                v.getUnit(),
                v.getRecordedAt(),
                v.getSortOrder());
    }
}
