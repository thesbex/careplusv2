package ma.careplus.confrere.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.confrere.domain.LetterTemplate;

/**
 * Vue en lecture d'un modèle de courrier confrère.
 */
public record LetterTemplateView(
        UUID id,
        String title,
        String body,
        boolean active,
        /** V065 — null = modèle partagé cabinet-wide, UUID = modèle privé d'un médecin. */
        UUID ownerUserId,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static LetterTemplateView of(LetterTemplate t) {
        return new LetterTemplateView(
                t.getId(),
                t.getTitle(),
                t.getBody(),
                t.isActive(),
                t.getOwnerUserId(),
                t.getCreatedAt(),
                t.getUpdatedAt()
        );
    }
}
