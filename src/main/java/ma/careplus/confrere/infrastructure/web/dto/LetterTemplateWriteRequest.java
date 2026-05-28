package ma.careplus.confrere.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Corps de requête pour créer ou mettre à jour un modèle de courrier confrère.
 * ADMIN only.
 */
public record LetterTemplateWriteRequest(

        @NotBlank(message = "Le titre est obligatoire.")
        @Size(max = 200, message = "Le titre ne peut pas dépasser 200 caractères.")
        String title,

        @NotBlank(message = "Le corps du texte est obligatoire.")
        String body,

        boolean active,

        /** V065 — null = modèle partagé cabinet-wide, UUID = modèle privé d'un médecin. */
        UUID ownerUserId
) {}
