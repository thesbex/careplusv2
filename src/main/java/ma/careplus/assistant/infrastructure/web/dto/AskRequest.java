package ma.careplus.assistant.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/**
 * Question posée à l'assistant.
 *
 * @param conversationId conversation existante à poursuivre, ou {@code null} pour
 *                       en créer une nouvelle.
 * @param patientId      dossier patient à joindre en contexte, ou {@code null}
 *                       pour un chat médical général.
 * @param message        texte de la question.
 */
public record AskRequest(
        UUID conversationId,
        UUID patientId,
        @NotBlank @Size(max = 4000) String message) {}
