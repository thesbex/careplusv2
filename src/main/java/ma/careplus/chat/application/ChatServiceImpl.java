package ma.careplus.chat.application;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import ma.careplus.chat.infrastructure.web.dto.ChannelView;
import ma.careplus.chat.infrastructure.web.dto.ColleagueView;
import ma.careplus.chat.infrastructure.web.dto.ConversationView;
import ma.careplus.chat.infrastructure.web.dto.DirectMessageView;
import ma.careplus.chat.infrastructure.web.dto.MessageView;
import ma.careplus.chat.infrastructure.web.dto.MessageView.AttachedPatient;
import ma.careplus.chat.infrastructure.web.dto.MessageView.MentionedUser;
import ma.careplus.chat.infrastructure.web.dto.MessageView.ReactionGroup;
import ma.careplus.chat.infrastructure.web.dto.MessageView.ReplyMeta;
import ma.careplus.chat.infrastructure.web.dto.PatientThreadView;
import ma.careplus.chat.infrastructure.web.dto.SendMessageBody;
import ma.careplus.chat.infrastructure.web.dto.TeamMemberView;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implémentation unifiée via {@code chat_conversation.kind}.
 *
 * <p>Pas de JPA — JdbcTemplate (pattern dashboard) suffit pour les 6 tables.
 * Lecture/écriture pures SQL, accès controlé par membership.
 */
@Service
public class ChatServiceImpl implements ChatService {

    private static final DateTimeFormatter HOUR_MIN = DateTimeFormatter.ofPattern("HH:mm");

    /** Palette stable basée sur les rôles — alignée avec la maquette. */
    private static final Map<String, String> ROLE_COLOR = Map.of(
            "MEDECIN", "#1E5AA8",
            "ADMIN", "#1E5AA8",
            "SECRETAIRE", "#3F7A3A",
            "ASSISTANT", "#B8500C",
            "LAB", "#3F7A3A",
            "RADIO", "#2A7CE7"
    );

    private final JdbcTemplate jdbc;

    public ChatServiceImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // ════════════════════════════════════════════════════════════════════════
    //  LISTES (rail gauche desktop + onglets mobile)
    // ════════════════════════════════════════════════════════════════════════

    @Override
    @Transactional
    public List<ChannelView> listChannels(UUID userId) {
        // Pas readOnly : ensureChannelMembership fait un INSERT (auto-join à la 1re lecture).
        ensureChannelMembership(userId);

        return jdbc.query("""
                SELECT c.id, c.name, c.topic,
                       (SELECT COUNT(*) FROM chat_conversation_member ccm
                          WHERE ccm.conversation_id = c.id) AS members,
                       (SELECT COUNT(*) FROM chat_message m
                          WHERE m.conversation_id = c.id
                            AND m.sender_id <> ?
                            AND m.created_at > COALESCE(
                                (SELECT last_read_at FROM chat_read_state
                                  WHERE conversation_id = c.id AND user_id = ?), '-infinity'::timestamptz)
                       ) AS unread,
                       (SELECT COUNT(*) FROM chat_message m
                          JOIN chat_message_mention mm ON mm.message_id = m.id
                          WHERE m.conversation_id = c.id
                            AND mm.mentioned_user_id = ?
                            AND m.sender_id <> ?
                            AND m.created_at > COALESCE(
                                (SELECT last_read_at FROM chat_read_state
                                  WHERE conversation_id = c.id AND user_id = ?), '-infinity'::timestamptz)
                       ) AS mentions
                  FROM chat_conversation c
                  JOIN chat_conversation_member ccm ON ccm.conversation_id = c.id AND ccm.user_id = ?
                 WHERE c.kind = 'CHANNEL'
              ORDER BY c.name
                """, (rs, n) -> new ChannelView(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getString("topic"),
                        rs.getInt("unread"),
                        rs.getInt("mentions"),
                        rs.getInt("members")),
                userId, userId, userId, userId, userId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DirectMessageView> listDirectMessages(UUID userId) {
        // DMs où le caller est membre. Pour chaque, retourner l'autre user + dernier message.
        return jdbc.query("""
                SELECT c.id,
                       other.id AS other_id, other.first_name, other.last_name, other.email,
                       (SELECT r.code FROM identity_user_role ur
                          JOIN identity_role r ON r.id = ur.role_id
                         WHERE ur.user_id = other.id
                         ORDER BY r.code LIMIT 1) AS other_role,
                       other.enabled AS other_enabled,
                       lm.body AS last_body,
                       lm.created_at AS last_at,
                       (SELECT COUNT(*) FROM chat_message m
                          WHERE m.conversation_id = c.id
                            AND m.sender_id <> ?
                            AND m.created_at > COALESCE(
                                (SELECT last_read_at FROM chat_read_state
                                  WHERE conversation_id = c.id AND user_id = ?), '-infinity'::timestamptz)
                       ) AS unread
                  FROM chat_conversation c
                  JOIN identity_user other ON other.id = CASE
                       WHEN c.user_a_id = ? THEN c.user_b_id
                       ELSE c.user_a_id END
                  LEFT JOIN LATERAL (
                      SELECT body, created_at FROM chat_message
                        WHERE conversation_id = c.id
                     ORDER BY created_at DESC LIMIT 1
                  ) lm ON TRUE
                 WHERE c.kind = 'DM'
                   AND (c.user_a_id = ? OR c.user_b_id = ?)
              ORDER BY c.last_message_at DESC NULLS LAST
                """, (rs, n) -> {
                    UUID convId = rs.getObject("id", UUID.class);
                    TeamMemberView other = buildMember(
                            rs.getObject("other_id", UUID.class),
                            rs.getString("first_name"), rs.getString("last_name"),
                            rs.getString("email"), rs.getString("other_role"),
                            rs.getBoolean("other_enabled"), userId);
                    OffsetDateTime at = rs.getObject("last_at", OffsetDateTime.class);
                    return new DirectMessageView(
                            convId, other,
                            rs.getString("last_body") == null ? "" : rs.getString("last_body"),
                            at == null ? "" : formatRelativeTime(at),
                            rs.getInt("unread"),
                            0);
                }, userId, userId, userId, userId, userId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<PatientThreadView> listPatientThreads(UUID userId) {
        return jdbc.query("""
                SELECT c.id, c.subject, c.color, c.last_message_at,
                       p.id AS patient_id, p.first_name AS p_first, p.last_name AS p_last,
                       (SELECT COUNT(*) FROM chat_conversation_member ccm
                          WHERE ccm.conversation_id = c.id) AS participants
                  FROM chat_conversation c
                  JOIN chat_conversation_member ccm ON ccm.conversation_id = c.id AND ccm.user_id = ?
                  JOIN patient_patient p ON p.id = c.patient_id
                 WHERE c.kind = 'PATIENT_THREAD'
              ORDER BY c.last_message_at DESC NULLS LAST
                """, (rs, n) -> {
                    UUID convId = rs.getObject("id", UUID.class);
                    String patientName = ((rs.getString("p_first") == null ? "" : rs.getString("p_first"))
                            + " " + (rs.getString("p_last") == null ? "" : rs.getString("p_last"))).strip();
                    OffsetDateTime at = rs.getObject("last_message_at", OffsetDateTime.class);
                    UUID patientId = rs.getObject("patient_id", UUID.class);
                    return new PatientThreadView(
                            convId,
                            patientName,
                            patientId == null ? "" : "PT-" + patientId.toString().substring(0, 6).toUpperCase(),
                            rs.getString("subject"),
                            rs.getInt("participants"),
                            at == null ? "—" : formatRelativeTime(at),
                            true,
                            rs.getString("color") == null ? "#1E5AA8" : rs.getString("color"));
                }, userId);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  DÉTAIL CONVERSATION
    // ════════════════════════════════════════════════════════════════════════

    @Override
    @Transactional(readOnly = true)
    public ConversationView getConversation(UUID userId, UUID conversationId) {
        assertMember(userId, conversationId);

        // Utilise un RowMapper avec rs.getObject(name, Type.class) pour forcer la coercion
        // du driver PostgreSQL — `queryForMap` retourne `java.sql.Timestamp` brut, pas OffsetDateTime,
        // ce qui ClassCast à l'usage.
        ConversationRow row = jdbc.queryForObject("""
                SELECT c.id, c.kind, c.name, c.topic, c.color, c.last_message_at,
                       c.user_a_id, c.user_b_id, c.patient_id, c.subject, c.pinned_message_id,
                       pm.body AS pinned_body,
                       p.first_name AS p_first, p.last_name AS p_last
                  FROM chat_conversation c
             LEFT JOIN chat_message pm ON pm.id = c.pinned_message_id
             LEFT JOIN patient_patient p ON p.id = c.patient_id
                 WHERE c.id = ?
                """, (rs, n) -> new ConversationRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("kind"),
                        rs.getString("name"),
                        rs.getString("topic"),
                        rs.getString("color"),
                        rs.getObject("last_message_at", OffsetDateTime.class),
                        rs.getObject("user_a_id", UUID.class),
                        rs.getObject("user_b_id", UUID.class),
                        rs.getObject("patient_id", UUID.class),
                        rs.getString("subject"),
                        rs.getObject("pinned_message_id", UUID.class),
                        rs.getString("pinned_body"),
                        rs.getString("p_first"),
                        rs.getString("p_last")),
                conversationId);

        if (row == null) {
            throw new NotFoundException("CHAT-004", "Conversation introuvable.");
        }

        String name;
        String topic = row.topic;

        switch (row.kind) {
            case "CHANNEL" -> name = row.name;
            case "DM" -> {
                UUID otherId = row.userA.equals(userId) ? row.userB : row.userA;
                String[] info = jdbc.queryForObject(
                        "SELECT first_name, last_name, email FROM identity_user WHERE id = ?",
                        (rs, n) -> new String[] {
                                rs.getString("first_name"),
                                rs.getString("last_name"),
                                rs.getString("email")
                        },
                        otherId);
                String first = info != null ? info[0] : null;
                String last = info != null ? info[1] : null;
                String email = info != null ? info[2] : null;
                String full = ((first == null ? "" : first) + " " + (last == null ? "" : last)).strip();
                if (full.isEmpty()) full = email == null ? "—" : email;
                name = full;
                topic = "Message direct";
            }
            case "PATIENT_THREAD" -> {
                name = ((row.pFirst == null ? "" : row.pFirst) + " "
                        + (row.pLast == null ? "" : row.pLast)).strip();
                topic = row.subject;
            }
            default -> throw new IllegalStateException("Unknown conversation kind: " + row.kind);
        }

        List<TeamMemberView> members = listMembers(userId, conversationId);

        Long unread = jdbc.queryForObject("""
                SELECT COUNT(*) FROM chat_message m
                 WHERE m.conversation_id = ?
                   AND m.sender_id <> ?
                   AND m.created_at > COALESCE(
                       (SELECT last_read_at FROM chat_read_state
                          WHERE conversation_id = ? AND user_id = ?), '-infinity'::timestamptz)
                """, Long.class, conversationId, userId, conversationId, userId);

        String patientName = null;
        String patientCode = null;
        if (row.patientId != null) {
            patientName = ((row.pFirst == null ? "" : row.pFirst) + " "
                    + (row.pLast == null ? "" : row.pLast)).strip();
            patientCode = "PT-" + row.patientId.toString().substring(0, 6).toUpperCase();
        }

        return new ConversationView(
                conversationId, row.kind, name, topic, row.color, members,
                row.lastMessageAt, unread == null ? 0 : unread.intValue(),
                row.pinnedMessageId, row.pinnedBody,
                row.patientId, patientName, patientCode);
    }

    /** Holder pour le mapper getConversation — évite les casts hasardeux sur Map<String,Object>. */
    private record ConversationRow(
            UUID id, String kind, String name, String topic, String color,
            OffsetDateTime lastMessageAt,
            UUID userA, UUID userB,
            UUID patientId, String subject,
            UUID pinnedMessageId, String pinnedBody,
            String pFirst, String pLast) {}

    // ════════════════════════════════════════════════════════════════════════
    //  MESSAGES
    // ════════════════════════════════════════════════════════════════════════

    @Override
    @Transactional(readOnly = true)
    public List<MessageView> listMessages(UUID userId, UUID conversationId, String beforeIsoOrNull, int limit) {
        assertMember(userId, conversationId);
        int effectiveLimit = Math.max(1, Math.min(limit, 200));

        // Pour le check 'lu par destinataire' en DM : last_read_at de l'autre.
        OffsetDateTime otherLastReadAt = jdbc.query(
                """
                SELECT crs.last_read_at FROM chat_read_state crs
                 WHERE crs.conversation_id = ?
                   AND crs.user_id <> ?
              ORDER BY crs.last_read_at DESC LIMIT 1
                """,
                rs -> rs.next() ? rs.getObject(1, OffsetDateTime.class) : null,
                conversationId, userId);

        String sql;
        Object[] args;
        if (beforeIsoOrNull == null || beforeIsoOrNull.isBlank()) {
            sql = """
                    SELECT m.id, m.conversation_id, m.parent_message_id, m.sender_id,
                           m.body, m.created_at, m.is_urgent, m.pinned_at,
                           m.patient_id,
                           u.first_name, u.last_name, u.email, u.enabled,
                           (SELECT r.code FROM identity_user_role ur
                              JOIN identity_role r ON r.id = ur.role_id
                             WHERE ur.user_id = u.id ORDER BY r.code LIMIT 1) AS sender_role,
                           p.first_name AS p_first, p.last_name AS p_last,
                           p.birth_date AS p_dob
                      FROM chat_message m
                      JOIN identity_user u ON u.id = m.sender_id
                 LEFT JOIN patient_patient p ON p.id = m.patient_id
                     WHERE m.conversation_id = ?
                  ORDER BY m.created_at DESC
                     LIMIT ?
                    """;
            args = new Object[] { conversationId, effectiveLimit };
        } else {
            OffsetDateTime before = OffsetDateTime.parse(beforeIsoOrNull);
            sql = """
                    SELECT m.id, m.conversation_id, m.parent_message_id, m.sender_id,
                           m.body, m.created_at, m.is_urgent, m.pinned_at,
                           m.patient_id,
                           u.first_name, u.last_name, u.email, u.enabled,
                           (SELECT r.code FROM identity_user_role ur
                              JOIN identity_role r ON r.id = ur.role_id
                             WHERE ur.user_id = u.id ORDER BY r.code LIMIT 1) AS sender_role,
                           p.first_name AS p_first, p.last_name AS p_last,
                           p.birth_date AS p_dob
                      FROM chat_message m
                      JOIN identity_user u ON u.id = m.sender_id
                 LEFT JOIN patient_patient p ON p.id = m.patient_id
                     WHERE m.conversation_id = ?
                       AND m.created_at < ?
                  ORDER BY m.created_at DESC
                     LIMIT ?
                    """;
            args = new Object[] { conversationId, Timestamp.from(before.toInstant()), effectiveLimit };
        }

        List<MessageView> rows = jdbc.query(sql, (rs, n) -> {
            UUID msgId = rs.getObject("id", UUID.class);
            UUID senderId = rs.getObject("sender_id", UUID.class);
            OffsetDateTime createdAt = rs.getObject("created_at", OffsetDateTime.class);
            boolean urgent = rs.getBoolean("is_urgent");
            boolean pinned = rs.getObject("pinned_at") != null;
            boolean readByRecipient =
                    senderId.equals(userId)
                            && otherLastReadAt != null
                            && !otherLastReadAt.isBefore(createdAt);

            TeamMemberView sender = buildMember(
                    senderId,
                    rs.getString("first_name"), rs.getString("last_name"),
                    rs.getString("email"), rs.getString("sender_role"),
                    rs.getBoolean("enabled"), userId);

            UUID parentId = rs.getObject("parent_message_id", UUID.class);

            AttachedPatient patient = null;
            UUID pid = rs.getObject("patient_id", UUID.class);
            if (pid != null) {
                String pfirst = rs.getString("p_first");
                String plast = rs.getString("p_last");
                String pname = ((pfirst == null ? "" : pfirst) + " " + (plast == null ? "" : plast)).strip();
                Integer age = null;
                java.sql.Date dob = rs.getObject("p_dob", java.sql.Date.class);
                if (dob != null) {
                    age = java.time.Period.between(
                            dob.toLocalDate(), java.time.LocalDate.now()).getYears();
                }
                patient = new AttachedPatient(
                        pid, pname,
                        "PT-" + pid.toString().substring(0, 6).toUpperCase(),
                        age);
            }

            return new MessageView(
                    msgId, rs.getObject("conversation_id", UUID.class), parentId,
                    senderId, sender, rs.getString("body"), createdAt,
                    urgent, pinned, readByRecipient,
                    patient,
                    List.of(), // mentions ajoutées au post-process
                    List.of(), // reactions ajoutées au post-process
                    null);     // reply meta ajouté au post-process
        }, args);

        if (rows.isEmpty()) return rows;

        // post-process : récupère mentions + reactions + reply meta en batch
        java.util.Set<UUID> msgIds = new java.util.HashSet<>();
        for (MessageView m : rows) msgIds.add(m.id());
        Map<UUID, List<MentionedUser>> mentionsByMsg = loadMentions(msgIds);
        Map<UUID, List<ReactionGroup>> reactionsByMsg = loadReactions(msgIds, userId);
        Map<UUID, ReplyMeta> repliesByParent = loadReplyMeta(msgIds);

        List<MessageView> enriched = new ArrayList<>(rows.size());
        for (MessageView m : rows) {
            enriched.add(new MessageView(
                    m.id(), m.conversationId(), m.parentMessageId(), m.senderId(), m.sender(),
                    m.body(), m.createdAt(), m.urgent(), m.pinned(), m.readByRecipient(),
                    m.patient(),
                    mentionsByMsg.getOrDefault(m.id(), List.of()),
                    reactionsByMsg.getOrDefault(m.id(), List.of()),
                    repliesByParent.get(m.id())));
        }

        // oldest first pour append-only
        java.util.Collections.reverse(enriched);
        return enriched;
    }

    @Override
    @Transactional
    public MessageView sendMessage(UUID userId, UUID conversationId, SendMessageBody body) {
        assertMember(userId, conversationId);
        String trimmed = body.body() == null ? "" : body.body().strip();
        if (trimmed.isEmpty() || trimmed.length() > 4000) {
            throw new BusinessException("CHAT-003",
                    "Le message doit contenir entre 1 et 4000 caractères.", 422);
        }
        UUID msgId = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        boolean urgent = body.urgent() != null && body.urgent();
        jdbc.update("""
                INSERT INTO chat_message (id, conversation_id, sender_id, body, parent_message_id,
                                          patient_id, is_urgent, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                msgId, conversationId, userId, trimmed,
                body.parentMessageId(), body.patientId(), urgent,
                Timestamp.from(now.toInstant()));
        jdbc.update("UPDATE chat_conversation SET last_message_at = ?, updated_at = now() WHERE id = ?",
                Timestamp.from(now.toInstant()), conversationId);

        // mentions explicites
        if (body.mentionedUserIds() != null) {
            for (UUID uid : body.mentionedUserIds()) {
                if (uid == null) continue;
                jdbc.update("""
                        INSERT INTO chat_message_mention (message_id, mentioned_user_id)
                        VALUES (?, ?)
                        ON CONFLICT DO NOTHING
                        """, msgId, uid);
            }
        }

        return listMessages(userId, conversationId, null, 1).stream()
                .filter(m -> m.id().equals(msgId)).findFirst()
                .orElseThrow(() -> new IllegalStateException("Message just inserted not found: " + msgId));
    }

    @Override
    @Transactional
    public void markRead(UUID userId, UUID conversationId) {
        assertMember(userId, conversationId);
        jdbc.update("""
                INSERT INTO chat_read_state (conversation_id, user_id, last_read_at)
                VALUES (?, ?, now())
                ON CONFLICT (conversation_id, user_id) DO UPDATE
                   SET last_read_at = EXCLUDED.last_read_at
                """, conversationId, userId);
    }

    @Override
    @Transactional
    public int unreadCount(UUID userId) {
        // Pas readOnly : ensureChannelMembership fait un INSERT.
        ensureChannelMembership(userId);
        Long total = jdbc.queryForObject("""
                SELECT COUNT(*)
                  FROM chat_message m
                  JOIN chat_conversation_member ccm
                       ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ?
                 WHERE m.sender_id <> ?
                   AND m.created_at > COALESCE(
                       (SELECT last_read_at FROM chat_read_state
                          WHERE conversation_id = m.conversation_id AND user_id = ?),
                       '-infinity'::timestamptz)
                """, Long.class, userId, userId, userId);
        return total == null ? 0 : total.intValue();
    }

    // ════════════════════════════════════════════════════════════════════════
    //  DM / PATIENT THREAD CREATION
    // ════════════════════════════════════════════════════════════════════════

    @Override
    @Transactional
    public ConversationView startDm(UUID userId, UUID otherUserId) {
        if (otherUserId.equals(userId)) {
            throw new BusinessException("CHAT-001", "Impossible de discuter avec soi-même.", 422);
        }
        Integer ok = jdbc.queryForObject(
                "SELECT COUNT(*) FROM identity_user WHERE id = ? AND enabled = TRUE",
                Integer.class, otherUserId);
        if (ok == null || ok == 0) {
            throw new NotFoundException("CHAT-002", "Utilisateur destinataire introuvable.");
        }

        // /!\ Java UUID.compareTo compare en SIGNÉ sur les 64 bits MSB, alors que
        // Postgres compare un UUID en unsigned byte. Pour un UUID dont le 1er
        // hex byte ≥ 0x80, les deux ordonnencements divergent. La contrainte
        // chat_conversation_dm_pair_chk (user_a_id < user_b_id) est PG-side,
        // donc on aligne la forme canonique via comparaison string (unsigned).
        boolean ylt = userId.toString().compareTo(otherUserId.toString()) < 0;
        UUID a = ylt ? userId : otherUserId;
        UUID b = ylt ? otherUserId : userId;

        UUID resolved;
        try {
            resolved = jdbc.queryForObject(
                    "SELECT id FROM chat_conversation WHERE kind='DM' AND user_a_id=? AND user_b_id=?",
                    UUID.class, a, b);
        } catch (EmptyResultDataAccessException e) {
            resolved = UUID.randomUUID();
            jdbc.update("""
                    INSERT INTO chat_conversation (id, kind, user_a_id, user_b_id)
                    VALUES (?, 'DM', ?, ?)
                    """, resolved, a, b);
            jdbc.update("INSERT INTO chat_conversation_member (conversation_id, user_id) VALUES (?, ?), (?, ?)",
                    resolved, a, resolved, b);
        }
        final UUID convId = resolved;
        return getConversation(userId, convId);
    }

    @Override
    @Transactional
    public ConversationView startPatientThread(UUID userId, UUID patientId, String subject,
                                               List<UUID> initialParticipants) {
        Integer hasPatient = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_patient WHERE id = ? AND deleted_at IS NULL",
                Integer.class, patientId);
        if (hasPatient == null || hasPatient == 0) {
            throw new NotFoundException("CHAT-005", "Patient introuvable.");
        }
        if (subject == null || subject.isBlank()) {
            throw new BusinessException("CHAT-006", "Sujet du fil requis.", 422);
        }

        UUID convId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO chat_conversation (id, kind, patient_id, subject, color)
                VALUES (?, 'PATIENT_THREAD', ?, ?, '#1E5AA8')
                """, convId, patientId, subject);
        jdbc.update("INSERT INTO chat_conversation_member (conversation_id, user_id) VALUES (?, ?)",
                convId, userId);
        if (initialParticipants != null) {
            for (UUID pid : initialParticipants) {
                if (pid == null || pid.equals(userId)) continue;
                jdbc.update("""
                        INSERT INTO chat_conversation_member (conversation_id, user_id)
                        VALUES (?, ?)
                        ON CONFLICT DO NOTHING
                        """, convId, pid);
            }
        }
        return getConversation(userId, convId);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  RÉACTIONS / PIN
    // ════════════════════════════════════════════════════════════════════════

    @Override
    @Transactional
    public void addReaction(UUID userId, UUID messageId, String emoji) {
        UUID convId = jdbc.queryForObject(
                "SELECT conversation_id FROM chat_message WHERE id = ?",
                UUID.class, messageId);
        assertMember(userId, convId);
        jdbc.update("""
                INSERT INTO chat_message_reaction (message_id, user_id, emoji)
                VALUES (?, ?, ?) ON CONFLICT DO NOTHING
                """, messageId, userId, emoji);
    }

    @Override
    @Transactional
    public void removeReaction(UUID userId, UUID messageId, String emoji) {
        UUID convId = jdbc.queryForObject(
                "SELECT conversation_id FROM chat_message WHERE id = ?",
                UUID.class, messageId);
        assertMember(userId, convId);
        jdbc.update("DELETE FROM chat_message_reaction WHERE message_id = ? AND user_id = ? AND emoji = ?",
                messageId, userId, emoji);
    }

    @Override
    @Transactional
    public void pinMessage(UUID userId, UUID conversationId, UUID messageId) {
        assertMember(userId, conversationId);
        Integer ok = jdbc.queryForObject(
                "SELECT COUNT(*) FROM chat_message WHERE id = ? AND conversation_id = ?",
                Integer.class, messageId, conversationId);
        if (ok == null || ok == 0) {
            throw new NotFoundException("CHAT-007", "Message introuvable dans cette conversation.");
        }
        jdbc.update("UPDATE chat_message SET pinned_at = now() WHERE id = ?", messageId);
        jdbc.update("UPDATE chat_conversation SET pinned_message_id = ? WHERE id = ?",
                messageId, conversationId);
    }

    @Override
    @Transactional
    public void unpinMessage(UUID userId, UUID conversationId) {
        assertMember(userId, conversationId);
        jdbc.update("""
                UPDATE chat_message SET pinned_at = NULL
                 WHERE id = (SELECT pinned_message_id FROM chat_conversation WHERE id = ?)
                """, conversationId);
        jdbc.update("UPDATE chat_conversation SET pinned_message_id = NULL WHERE id = ?",
                conversationId);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  MEMBRES / TEAM
    // ════════════════════════════════════════════════════════════════════════

    @Override
    @Transactional(readOnly = true)
    public List<TeamMemberView> listMembers(UUID userId, UUID conversationId) {
        assertMember(userId, conversationId);
        return jdbc.query("""
                SELECT u.id, u.first_name, u.last_name, u.email, u.enabled, u.last_seen_at,
                       (SELECT r.code FROM identity_user_role ur
                          JOIN identity_role r ON r.id = ur.role_id
                         WHERE ur.user_id = u.id ORDER BY r.code LIMIT 1) AS role_code
                  FROM chat_conversation_member ccm
                  JOIN identity_user u ON u.id = ccm.user_id
                 WHERE ccm.conversation_id = ?
              ORDER BY u.last_name, u.first_name
                """, (rs, n) -> buildMember(
                        rs.getObject("id", UUID.class),
                        rs.getString("first_name"), rs.getString("last_name"),
                        rs.getString("email"), rs.getString("role_code"),
                        rs.getBoolean("enabled"),
                        rs.getObject("last_seen_at", OffsetDateTime.class),
                        userId),
                conversationId);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeamMemberView> listTeam(UUID userId) {
        return jdbc.query("""
                SELECT u.id, u.first_name, u.last_name, u.email, u.enabled, u.last_seen_at,
                       (SELECT r.code FROM identity_user_role ur
                          JOIN identity_role r ON r.id = ur.role_id
                         WHERE ur.user_id = u.id ORDER BY r.code LIMIT 1) AS role_code
                  FROM identity_user u
                 WHERE u.enabled = TRUE
              ORDER BY u.last_name, u.first_name
                """, (rs, n) -> buildMember(
                        rs.getObject("id", UUID.class),
                        rs.getString("first_name"), rs.getString("last_name"),
                        rs.getString("email"), rs.getString("role_code"),
                        rs.getBoolean("enabled"),
                        rs.getObject("last_seen_at", OffsetDateTime.class),
                        userId));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ColleagueView> listColleagues(UUID userId) {
        return jdbc.query("""
                SELECT u.id, u.first_name, u.last_name, u.email,
                       (SELECT r.code FROM identity_user_role ur
                          JOIN identity_role r ON r.id = ur.role_id
                         WHERE ur.user_id = u.id ORDER BY r.code LIMIT 1) AS role_code
                  FROM identity_user u
                 WHERE u.id <> ?
                   AND u.enabled = TRUE
              ORDER BY u.last_name, u.first_name
                """, (rs, n) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    String first = rs.getString("first_name");
                    String last = rs.getString("last_name");
                    String email = rs.getString("email");
                    String role = rs.getString("role_code");
                    String fullName = ((first == null ? "" : first) + " " + (last == null ? "" : last)).strip();
                    if (fullName.isEmpty()) fullName = email == null ? "—" : email;
                    return new ColleagueView(id, fullName, role);
                }, userId);
    }

    @Override
    @Transactional
    public void heartbeat(UUID userId) {
        jdbc.update("UPDATE identity_user SET last_seen_at = now() WHERE id = ?", userId);
    }

    // ════════════════════════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════════════════════════

    /** Garantit que le user est membre des canaux par défaut (auto-join à la 1re lecture). */
    private void ensureChannelMembership(UUID userId) {
        jdbc.update("""
                INSERT INTO chat_conversation_member (conversation_id, user_id)
                SELECT c.id, ?
                  FROM chat_conversation c
                 WHERE c.kind = 'CHANNEL'
                ON CONFLICT DO NOTHING
                """, userId);
    }

    private void assertMember(UUID userId, UUID conversationId) {
        if (conversationId == null) {
            throw new NotFoundException("CHAT-004", "Conversation introuvable.");
        }
        Integer ok;
        try {
            ok = jdbc.queryForObject("""
                    SELECT COUNT(*) FROM chat_conversation_member
                     WHERE conversation_id = ? AND user_id = ?
                    """, Integer.class, conversationId, userId);
        } catch (Exception e) {
            ok = 0;
        }
        if (ok == null || ok == 0) {
            throw new NotFoundException("CHAT-004", "Conversation introuvable.");
        }
    }

    private TeamMemberView buildMember(UUID id, String first, String last, String email,
                                        String role, boolean enabled, UUID caller) {
        return buildMember(id, first, last, email, role, enabled, null, caller);
    }

    /**
     * @param lastSeenAt timestamp du dernier heartbeat (V049). Si null → user jamais connecté → off.
     */
    private TeamMemberView buildMember(UUID id, String first, String last, String email,
                                        String role, boolean enabled,
                                        OffsetDateTime lastSeenAt, UUID caller) {
        String fullName = ((first == null ? "" : first) + " " + (last == null ? "" : last)).strip();
        if (fullName.isEmpty()) fullName = email == null ? "—" : email;
        String roleLabel = roleLabelOf(role);
        String initials = "";
        if (first != null && !first.isEmpty()) initials += first.substring(0, 1);
        if (last != null && !last.isEmpty()) initials += last.substring(0, 1);
        initials = initials.toUpperCase(Locale.ROOT);
        String color = role != null ? ROLE_COLOR.getOrDefault(role, "#6B6B6B") : "#6B6B6B";
        String presence = computePresence(id, enabled, lastSeenAt, caller);
        return new TeamMemberView(id, fullName, roleLabel, initials, color, presence);
    }

    /**
     * Calcul de la présence à partir du heartbeat :
     *   caller → 'self'
     *   désactivé → 'off'
     *   last_seen_at null OU > 5 min → 'off'
     *   > 90 s → 'away'
     *   sinon → 'on'
     */
    private static String computePresence(UUID id, boolean enabled,
                                           OffsetDateTime lastSeenAt, UUID caller) {
        if (id.equals(caller)) return "self";
        if (!enabled) return "off";
        if (lastSeenAt == null) return "off";
        Duration delta = Duration.between(lastSeenAt, OffsetDateTime.now());
        if (delta.getSeconds() < 90) return "on";
        if (delta.toMinutes() < 5) return "away";
        return "off";
    }

    private static String roleLabelOf(String code) {
        if (code == null) return "Utilisateur";
        return switch (code) {
            case "MEDECIN" -> "Médecin";
            case "ADMIN" -> "Administrateur";
            case "SECRETAIRE" -> "Secrétaire";
            case "ASSISTANT" -> "Assistant(e)";
            case "LAB" -> "Laboratoire";
            case "RADIO" -> "Radiologie";
            default -> code;
        };
    }

    private Map<UUID, List<MentionedUser>> loadMentions(java.util.Set<UUID> msgIds) {
        if (msgIds.isEmpty()) return Map.of();
        Map<UUID, List<MentionedUser>> out = new HashMap<>();
        String inClause = "(" + msgIds.stream().map(id -> "?").reduce((a, b) -> a + "," + b).orElse("") + ")";
        Object[] args = msgIds.toArray();
        jdbc.query("""
                SELECT mm.message_id, mm.mentioned_user_id, u.first_name, u.last_name
                  FROM chat_message_mention mm
                  JOIN identity_user u ON u.id = mm.mentioned_user_id
                 WHERE mm.message_id IN """ + inClause,
                rs -> {
                    UUID mid = rs.getObject("message_id", UUID.class);
                    UUID uid = rs.getObject("mentioned_user_id", UUID.class);
                    String name = ((rs.getString("first_name") == null ? "" : rs.getString("first_name")) + " " +
                            (rs.getString("last_name") == null ? "" : rs.getString("last_name"))).strip();
                    out.computeIfAbsent(mid, k -> new ArrayList<>()).add(new MentionedUser(uid, name));
                }, args);
        return out;
    }

    private Map<UUID, List<ReactionGroup>> loadReactions(java.util.Set<UUID> msgIds, UUID caller) {
        if (msgIds.isEmpty()) return Map.of();
        String inClause = "(" + msgIds.stream().map(id -> "?").reduce((a, b) -> a + "," + b).orElse("") + ")";
        Object[] args = msgIds.toArray();
        Map<UUID, LinkedHashMap<String, int[]>> tmp = new HashMap<>(); // {msg → {emoji → [count, mine]}}
        jdbc.query("""
                SELECT message_id, emoji, user_id
                  FROM chat_message_reaction
                 WHERE message_id IN """ + inClause,
                rs -> {
                    UUID mid = rs.getObject("message_id", UUID.class);
                    String emoji = rs.getString("emoji");
                    UUID uid = rs.getObject("user_id", UUID.class);
                    LinkedHashMap<String, int[]> emojiMap = tmp.computeIfAbsent(mid, k -> new LinkedHashMap<>());
                    int[] cnt = emojiMap.computeIfAbsent(emoji, k -> new int[] { 0, 0 });
                    cnt[0]++;
                    if (uid.equals(caller)) cnt[1] = 1;
                }, args);
        Map<UUID, List<ReactionGroup>> out = new HashMap<>();
        for (Map.Entry<UUID, LinkedHashMap<String, int[]>> e : tmp.entrySet()) {
            List<ReactionGroup> list = new ArrayList<>();
            for (Map.Entry<String, int[]> r : e.getValue().entrySet()) {
                list.add(new ReactionGroup(r.getKey(), r.getValue()[0], r.getValue()[1] == 1));
            }
            out.put(e.getKey(), list);
        }
        return out;
    }

    private Map<UUID, ReplyMeta> loadReplyMeta(java.util.Set<UUID> msgIds) {
        if (msgIds.isEmpty()) return Map.of();
        String inClause = "(" + msgIds.stream().map(id -> "?").reduce((a, b) -> a + "," + b).orElse("") + ")";
        Object[] args = msgIds.toArray();
        Map<UUID, ReplyMeta> out = new HashMap<>();
        // par message parent : count enfants + dernier created_at + dernier expéditeur
        jdbc.query("""
                SELECT m.parent_message_id, COUNT(*) AS cnt,
                       MAX(m.created_at) AS last_at,
                       (SELECT u.first_name || ' ' || u.last_name
                          FROM chat_message mm
                          JOIN identity_user u ON u.id = mm.sender_id
                         WHERE mm.parent_message_id = m.parent_message_id
                      ORDER BY mm.created_at DESC LIMIT 1) AS last_sender
                  FROM chat_message m
                 WHERE m.parent_message_id IN """ + inClause + """

              GROUP BY m.parent_message_id
                """,
                rs -> {
                    UUID parent = rs.getObject("parent_message_id", UUID.class);
                    int cnt = rs.getInt("cnt");
                    OffsetDateTime at = rs.getObject("last_at", OffsetDateTime.class);
                    String last = rs.getString("last_sender");
                    out.put(parent, new ReplyMeta(cnt, at, last == null ? "" : last.strip()));
                }, args);
        return out;
    }

    /** Format compact pour la liste à gauche : 'HH:mm' aujourd'hui, 'Hier', sinon date courte. */
    private static String formatRelativeTime(OffsetDateTime at) {
        OffsetDateTime now = OffsetDateTime.now();
        Duration delta = Duration.between(at, now);
        if (delta.toDays() == 0 && at.getDayOfYear() == now.getDayOfYear()) {
            return at.format(HOUR_MIN);
        }
        if (delta.toDays() <= 1) return "Hier";
        if (delta.toDays() < 7) return delta.toDays() + " j";
        return at.toLocalDate().toString();
    }

    // Utilitaire de parsing @prénom (non utilisé v1 — mentions explicites via DTO).
    @SuppressWarnings("unused")
    private static List<String> extractMentionHandles(String text) {
        List<String> out = new ArrayList<>();
        Matcher m = Pattern.compile("@([A-Za-zÀ-ÿ.\\-']+)").matcher(text);
        while (m.find()) out.add(m.group(1));
        return out;
    }
}
