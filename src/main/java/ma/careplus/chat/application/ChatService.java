package ma.careplus.chat.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.chat.infrastructure.web.dto.ChannelView;
import ma.careplus.chat.infrastructure.web.dto.ColleagueView;
import ma.careplus.chat.infrastructure.web.dto.ConversationView;
import ma.careplus.chat.infrastructure.web.dto.DirectMessageView;
import ma.careplus.chat.infrastructure.web.dto.MessageView;
import ma.careplus.chat.infrastructure.web.dto.PatientThreadView;
import ma.careplus.chat.infrastructure.web.dto.SendMessageBody;
import ma.careplus.chat.infrastructure.web.dto.TeamMemberView;

/**
 * Chat module — messagerie d'équipe iso-maquette.
 *
 * <p>Modèle unifié sur {@code chat_conversation} avec {@code kind ∈ {DM, CHANNEL, PATIENT_THREAD}}.
 * Le caller ne voit que les conversations dont il est membre.
 */
public interface ChatService {

    // ── Liste maquette gauche / mobile ────────────────────────────────────────
    List<ChannelView> listChannels(UUID userId);
    List<DirectMessageView> listDirectMessages(UUID userId);
    List<PatientThreadView> listPatientThreads(UUID userId);

    // ── Conversation détaillée (header + members + pinned + messages) ────────
    ConversationView getConversation(UUID userId, UUID conversationId);

    // ── Messages ─────────────────────────────────────────────────────────────
    /**
     * Liste les messages d'une conversation, du plus ancien au plus récent (append-only).
     * Cursor sur {@code created_at} via {@code before} (ISO instant) pour scroll back.
     */
    List<MessageView> listMessages(UUID userId, UUID conversationId, String beforeIsoOrNull, int limit);

    MessageView sendMessage(UUID userId, UUID conversationId, SendMessageBody body);

    void markRead(UUID userId, UUID conversationId);

    int unreadCount(UUID userId);

    // ── DM helpers ───────────────────────────────────────────────────────────
    /** Démarre (ou retourne) la DM avec un autre user. */
    ConversationView startDm(UUID userId, UUID otherUserId);

    // ── Patient-thread helpers ───────────────────────────────────────────────
    /** Crée un fil patient avec sujet et participants — médecin créateur inclus. */
    ConversationView startPatientThread(UUID userId, UUID patientId, String subject,
                                        List<UUID> initialParticipants);

    // ── Réactions ─────────────────────────────────────────────────────────────
    void addReaction(UUID userId, UUID messageId, String emoji);
    void removeReaction(UUID userId, UUID messageId, String emoji);

    // ── Pinned ───────────────────────────────────────────────────────────────
    void pinMessage(UUID userId, UUID conversationId, UUID messageId);
    void unpinMessage(UUID userId, UUID conversationId);

    // ── Membres ──────────────────────────────────────────────────────────────
    List<TeamMemberView> listMembers(UUID userId, UUID conversationId);

    /** Tous les utilisateurs actifs du cabinet (picker Nouveau message / présence). */
    List<TeamMemberView> listTeam(UUID userId);

    /** Picker minimal (collègues actifs hors caller) pour le bouton Nouveau message. */
    List<ColleagueView> listColleagues(UUID userId);

    /** Met à jour last_seen_at du caller — appelé toutes les 30 s par le client. */
    void heartbeat(UUID userId);
}
