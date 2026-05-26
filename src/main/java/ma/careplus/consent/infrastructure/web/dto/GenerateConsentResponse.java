package ma.careplus.consent.infrastructure.web.dto;

import java.util.UUID;

/**
 * Réponse à la génération d'un consentement : identifiant du document créé.
 * Le frontend peut ensuite récupérer le PDF via GET /api/documents/{documentId}/content.
 * QA9-13.
 */
public record GenerateConsentResponse(UUID documentId) {}
