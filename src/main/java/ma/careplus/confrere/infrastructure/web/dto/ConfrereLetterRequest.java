package ma.careplus.confrere.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Corps de requête pour générer un courrier au confrère.
 * Le médecin rédige la lettre directement dans le corps de la requête.
 * QA9-10.
 */
public record ConfrereLetterRequest(

        @NotBlank(message = "Le nom du destinataire est obligatoire.")
        String recipientName,

        /** Spécialité du confrère destinataire (optionnel). */
        String recipientSpecialty,

        /** Ville du confrère destinataire (optionnel). */
        String recipientCity,

        @NotBlank(message = "Le corps de la lettre est obligatoire.")
        String body
) {}
