package ma.careplus.consent.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.consent.domain.ConsentTemplate;

/**
 * Vue en lecture d'un modèle de consentement. QA9-13.
 */
public record ConsentTemplateView(
        UUID id,
        String type,
        String title,
        String body,
        boolean active,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static ConsentTemplateView of(ConsentTemplate t) {
        return new ConsentTemplateView(
                t.getId(),
                t.getType(),
                t.getTitle(),
                t.getBody(),
                t.isActive(),
                t.getCreatedAt(),
                t.getUpdatedAt()
        );
    }
}
