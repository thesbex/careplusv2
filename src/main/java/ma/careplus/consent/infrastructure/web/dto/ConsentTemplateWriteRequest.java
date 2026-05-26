package ma.careplus.consent.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Corps de requête pour créer ou mettre à jour un modèle de consentement.
 * QA9-13 — ADMIN only.
 */
public record ConsentTemplateWriteRequest(

        @NotBlank(message = "Le type est obligatoire.")
        @Pattern(
                regexp = "PARTAGE_DOSSIER|ACTE_OPERATOIRE|ANESTHESIE|IMAGERIE|PRELEVEMENT|HOSPITALISATION|AUTRE",
                message = "Type invalide. Valeurs acceptées : PARTAGE_DOSSIER, ACTE_OPERATOIRE, ANESTHESIE, IMAGERIE, PRELEVEMENT, HOSPITALISATION, AUTRE."
        )
        String type,

        @NotBlank(message = "Le titre est obligatoire.")
        @Size(max = 200, message = "Le titre ne peut pas dépasser 200 caractères.")
        String title,

        @NotBlank(message = "Le corps du texte est obligatoire.")
        String body,

        boolean active
) {}
