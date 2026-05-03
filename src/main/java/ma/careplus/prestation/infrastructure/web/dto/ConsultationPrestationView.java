package ma.careplus.prestation.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.UUID;
import ma.careplus.prestation.domain.ConsultationPrestation;

public record ConsultationPrestationView(
        UUID id,
        UUID consultationId,
        UUID prestationId,
        String prestationCode,
        String prestationLabel,
        BigDecimal unitPrice,
        int quantity,
        BigDecimal lineTotal,
        String notes
) {
    public static ConsultationPrestationView of(ConsultationPrestation cp, String code, String label) {
        BigDecimal total = cp.getUnitPrice().multiply(BigDecimal.valueOf(cp.getQuantity()));
        return new ConsultationPrestationView(
                cp.getId(), cp.getConsultationId(), cp.getPrestationId(),
                code, label, cp.getUnitPrice(), cp.getQuantity(), total, cp.getNotes());
    }
}
