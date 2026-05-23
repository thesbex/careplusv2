package ma.careplus.chat.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Vue d'un message — couvre les besoins de la maquette : threading, mentions, réactions,
 * attache patient, urgent, lecture par le destinataire.
 */
public record MessageView(
        UUID id,
        UUID conversationId,
        UUID parentMessageId,
        UUID senderId,
        TeamMemberView sender,
        String body,
        OffsetDateTime createdAt,
        boolean urgent,
        boolean pinned,
        boolean readByRecipient,
        AttachedPatient patient,
        List<MentionedUser> mentions,
        List<ReactionGroup> reactions,
        ReplyMeta reply,
        Attachment attachment) {

    public record AttachedPatient(UUID id, String name, String pid, Integer age) {}

    public record MentionedUser(UUID userId, String name) {}

    public record ReactionGroup(String emoji, int count, boolean reactedByMe) {}

    public record ReplyMeta(int count, OffsetDateTime lastAt, String lastSenderName) {}

    /** V053 — pièce jointe d'un message chat. {@code null} si pas de PJ. */
    public record Attachment(UUID id, String filename, String mime, long sizeBytes) {}
}
