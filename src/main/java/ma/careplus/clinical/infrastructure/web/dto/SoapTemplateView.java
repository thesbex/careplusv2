package ma.careplus.clinical.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.clinical.domain.SoapTemplate;

/** Vue lecture d'un modèle SOAP. */
public record SoapTemplateView(
        UUID id,
        String name,
        String subjectif,
        String objectif,
        String analyse,
        String plan,
        OffsetDateTime updatedAt) {

    public static SoapTemplateView of(SoapTemplate t) {
        return new SoapTemplateView(
                t.getId(), t.getName(),
                t.getSubjectif(), t.getObjectif(), t.getAnalyse(), t.getPlan(),
                t.getUpdatedAt());
    }
}
