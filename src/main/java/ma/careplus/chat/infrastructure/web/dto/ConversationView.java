package ma.careplus.chat.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Vue détaillée d'une conversation pour le panneau central + header.
 */
public record ConversationView(
        UUID id,
        String kind,               // 'DM' | 'CHANNEL' | 'PATIENT_THREAD'
        String name,               // pour DM : nom de l'autre user · pour CHANNEL : 'urgences' · pour THREAD : nom patient
        String topic,              // sous-titre / sujet
        String color,              // hex pour le pastille / sticker
        List<TeamMemberView> members,
        OffsetDateTime lastMessageAt,
        int unreadCount,
        UUID pinnedMessageId,
        String pinnedMessageBody,
        // attache patient pour kind=PATIENT_THREAD :
        UUID patientId,
        String patientName,
        String patientCode) {}
