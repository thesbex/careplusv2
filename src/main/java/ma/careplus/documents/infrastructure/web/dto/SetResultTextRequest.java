package ma.careplus.documents.infrastructure.web.dto;

import jakarta.validation.constraints.Size;

/**
 * V045 — payload pour {@code PUT /api/prescriptions/lines/{lineId}/result-text}.
 *
 * <p>{@code text} peut être {@code null} ou vide : dans les deux cas la valeur
 * est effacée côté serveur. La borne 8000 caractères suit le bon sens — un
 * texte plus long passerait par le PDF. Le mapping est fait colonne à colonne
 * sur {@code clinical_prescription_line.result_text} (TEXT, donc pas de
 * troncature côté DB ; la limite est purement applicative).
 */
public record SetResultTextRequest(
        @Size(max = 8000, message = "Le résultat ne peut dépasser 8000 caractères.")
        String text
) {}
