package ma.careplus.confrere.infrastructure.web.dto;

import java.util.UUID;

/**
 * Réponse à la génération d'un courrier au confrère.
 * Le frontend peut ensuite récupérer le PDF via GET /api/documents/{documentId}/content.
 * QA9-10.
 */
public record ConfrereLetterResponse(UUID documentId) {}
