package ma.careplus.chat.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

/**
 * Payload POST /api/chat/conversations/{id}/messages.
 *
 * @param body         texte brut, 1..4000 chars.
 * @param mentionedUserIds users explicitement mentionnés (résolus côté FE depuis le tag @prénom).
 *                         Le serveur insère les lignes dans chat_message_mention.
 * @param patientId    attache patient optionnelle.
 * @param parentMessageId si réponse à un message (threading).
 * @param urgent       flag urgent.
 */
public record SendMessageBody(
        @NotBlank @Size(min = 1, max = 4000) String body,
        List<UUID> mentionedUserIds,
        UUID patientId,
        UUID parentMessageId,
        Boolean urgent) {}
