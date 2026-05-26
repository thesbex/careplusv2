package ma.careplus.consent.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

/**
 * Corps de requête pour générer un document de consentement pour un patient.
 * Le médecin peut partir d'un modèle (templateId optionnel — le frontend
 * pré-remplit title+body) mais envoie toujours le texte final éditable.
 * QA9-13.
 */
public record GenerateConsentRequest(

        /** Optionnel — référence au modèle utilisé comme point de départ. */
        UUID templateId,

        @NotBlank(message = "Le titre est obligatoire.")
        String title,

        @NotBlank(message = "Le corps du texte est obligatoire.")
        String body
) {}
