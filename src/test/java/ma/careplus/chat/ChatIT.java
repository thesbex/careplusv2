package ma.careplus.chat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Integration tests pour le module chat unifié (V048 — canaux + DM + patient thread).
 *
 * <p>Scénarios bottlés :
 * <ol>
 *   <li>5 canaux par défaut seedés ; auto-join à la 1re lecture.</li>
 *   <li>Send message dans un canal + last_message_at mis à jour.</li>
 *   <li>Mention enregistrée + comptée pour le destinataire.</li>
 *   <li>Réaction add/remove (idempotent côté add).</li>
 *   <li>Pin/unpin via endpoints dédiés.</li>
 *   <li>DM start idempotent.</li>
 *   <li>Patient thread créé avec membres.</li>
 *   <li>Read receipt — A envoie, B mark-read, A re-fetch → readByRecipient true.</li>
 *   <li>404 non-membre sur GET / POST / mark-read.</li>
 *   <li>unread-count agrège canaux + DM pour le caller.</li>
 *   <li>401 anonymous.</li>
 * </ol>
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Testcontainers
class ChatIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("careplus_test")
            .withUsername("test")
            .withPassword("test");

    private static final UUID ROLE_SECRETAIRE = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ROLE_MEDECIN    = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final String PWD = "Chat-IT-2026!";

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired LoginRateLimitFilter rateLimitFilter;

    UUID medId;
    UUID secId;
    UUID asstId;

    @BeforeEach
    void seed() {
        rateLimitFilter.clearBucketsForTests();
        jdbc.update("DELETE FROM chat_message_reaction");
        jdbc.update("DELETE FROM chat_message_mention");
        jdbc.update("UPDATE chat_conversation SET pinned_message_id = NULL");
        jdbc.update("DELETE FROM chat_read_state");
        jdbc.update("DELETE FROM chat_message");
        jdbc.update("DELETE FROM chat_conversation_member WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'chat-it-%')");
        jdbc.update("DELETE FROM chat_conversation WHERE kind <> 'CHANNEL'");
        jdbc.update("DELETE FROM identity_user_role WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'chat-it-%')");
        jdbc.update("DELETE FROM identity_refresh_token WHERE user_id IN "
                + "(SELECT id FROM identity_user WHERE email LIKE 'chat-it-%')");
        jdbc.update("DELETE FROM identity_user WHERE email LIKE 'chat-it-%'");

        medId = createUser("med", "Med", "Test", ROLE_MEDECIN);
        secId = createUser("sec", "Sec", "Test", ROLE_SECRETAIRE);
        asstId = createUser("asst", "Asst", "Test", ROLE_SECRETAIRE);
    }

    private UUID createUser(String prefix, String first, String last, UUID roleId) {
        UUID id = UUID.randomUUID();
        String email = "chat-it-" + prefix + "-" + id + "@test.ma";
        jdbc.update("""
                INSERT INTO identity_user (id, email, password_hash, first_name, last_name,
                    enabled, failed_attempts, version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, TRUE, 0, 0, now(), now())
                """, id, email, passwordEncoder.encode(PWD), first, last);
        jdbc.update("INSERT INTO identity_user_role (user_id, role_id) VALUES (?, ?)", id, roleId);
        return id;
    }

    private String bearer(UUID userId) throws Exception {
        String email = jdbc.queryForObject("SELECT email FROM identity_user WHERE id = ?",
                String.class, userId);
        MvcResult r = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PWD + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return "Bearer " + objectMapper.readTree(r.getResponse().getContentAsString())
                .get("accessToken").asText();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tests
    // ─────────────────────────────────────────────────────────────────────────

    @Test
    void channels_seeded_and_auto_join_on_first_read() throws Exception {
        MvcResult r = mockMvc.perform(get("/api/chat/channels")
                        .header("Authorization", bearer(medId)))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = objectMapper.readTree(r.getResponse().getContentAsString());
        assertThat(arr.isArray()).isTrue();
        // 5 canaux seedés en V048
        assertThat(arr.size()).isGreaterThanOrEqualTo(5);
    }

    @Test
    void send_in_channel_updates_last_message_at_and_appears_in_list() throws Exception {
        String auth = bearer(medId);
        // 1. récup les canaux pour avoir un id
        MvcResult chans = mockMvc.perform(get("/api/chat/channels").header("Authorization", auth))
                .andExpect(status().isOk()).andReturn();
        String channelId = objectMapper.readTree(chans.getResponse().getContentAsString())
                .get(0).get("id").asText();

        mockMvc.perform(post("/api/chat/conversations/" + channelId + "/messages")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Bonjour équipe\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body").value("Bonjour équipe"));

        // last_message_at en DB est non-null
        Boolean hasLast = jdbc.queryForObject(
                "SELECT last_message_at IS NOT NULL FROM chat_conversation WHERE id = ?::uuid",
                Boolean.class, channelId);
        assertThat(hasLast).isTrue();

        // GET messages renvoie le message
        MvcResult list = mockMvc.perform(get("/api/chat/conversations/" + channelId + "/messages")
                        .header("Authorization", auth))
                .andExpect(status().isOk()).andReturn();
        JsonNode msgs = objectMapper.readTree(list.getResponse().getContentAsString());
        assertThat(msgs.isArray()).isTrue();
        assertThat(msgs.size()).isGreaterThanOrEqualTo(1);
    }

    @Test
    void mentions_are_persisted_and_counted_for_recipient() throws Exception {
        String medAuth = bearer(medId);
        String secAuth = bearer(secId);

        MvcResult chans = mockMvc.perform(get("/api/chat/channels").header("Authorization", medAuth))
                .andExpect(status().isOk()).andReturn();
        String channelId = objectMapper.readTree(chans.getResponse().getContentAsString())
                .get(0).get("id").asText();
        // Force le sec à être membre du canal (auto-join)
        mockMvc.perform(get("/api/chat/channels").header("Authorization", secAuth))
                .andExpect(status().isOk());

        // med envoie un message qui mentionne sec
        mockMvc.perform(post("/api/chat/conversations/" + channelId + "/messages")
                        .header("Authorization", medAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"@Sec merci\",\"mentionedUserIds\":[\"" + secId + "\"]}"))
                .andExpect(status().isOk());

        // sec voit la mention dans la liste des canaux
        MvcResult secChans = mockMvc.perform(get("/api/chat/channels")
                        .header("Authorization", secAuth))
                .andExpect(status().isOk()).andReturn();
        JsonNode arr = objectMapper.readTree(secChans.getResponse().getContentAsString());
        JsonNode target = null;
        for (JsonNode n : arr) {
            if (n.get("id").asText().equals(channelId)) { target = n; break; }
        }
        assertThat(target).isNotNull();
        assertThat(target.get("mentions").asInt()).isEqualTo(1);
    }

    @Test
    void reactions_add_and_remove() throws Exception {
        String auth = bearer(medId);
        String channelId = firstChannelId(auth);
        String msgId = sendMessage(auth, channelId, "yo");

        mockMvc.perform(post("/api/chat/messages/" + msgId + "/reactions")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"👍\"}"))
                .andExpect(status().isNoContent());

        // re-poster le même emoji : idempotent (no error)
        mockMvc.perform(post("/api/chat/messages/" + msgId + "/reactions")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"👍\"}"))
                .andExpect(status().isNoContent());

        Integer rcount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM chat_message_reaction WHERE message_id = ?::uuid",
                Integer.class, msgId);
        assertThat(rcount).isEqualTo(1);

        // removal
        mockMvc.perform(delete("/api/chat/messages/" + msgId + "/reactions/" + java.net.URLEncoder.encode("👍", java.nio.charset.StandardCharsets.UTF_8))
                        .header("Authorization", auth))
                .andExpect(status().isNoContent());
        Integer after = jdbc.queryForObject(
                "SELECT COUNT(*) FROM chat_message_reaction WHERE message_id = ?::uuid",
                Integer.class, msgId);
        assertThat(after).isZero();
    }

    @Test
    void pin_and_unpin() throws Exception {
        String auth = bearer(medId);
        String channelId = firstChannelId(auth);
        String msgId = sendMessage(auth, channelId, "important");

        mockMvc.perform(post("/api/chat/conversations/" + channelId + "/pin")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messageId\":\"" + msgId + "\"}"))
                .andExpect(status().isNoContent());

        UUID pinned = jdbc.queryForObject(
                "SELECT pinned_message_id FROM chat_conversation WHERE id = ?::uuid",
                UUID.class, channelId);
        assertThat(pinned.toString()).isEqualTo(msgId);

        mockMvc.perform(delete("/api/chat/conversations/" + channelId + "/pin")
                        .header("Authorization", auth))
                .andExpect(status().isNoContent());

        UUID after = jdbc.queryForObject(
                "SELECT pinned_message_id FROM chat_conversation WHERE id = ?::uuid",
                UUID.class, channelId);
        assertThat(after).isNull();
    }

    @Test
    void start_dm_idempotent() throws Exception {
        String auth = bearer(medId);
        MvcResult r1 = mockMvc.perform(post("/api/chat/direct-messages")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"otherUserId\":\"" + secId + "\"}"))
                .andExpect(status().isOk()).andReturn();
        MvcResult r2 = mockMvc.perform(post("/api/chat/direct-messages")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"otherUserId\":\"" + secId + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String id1 = objectMapper.readTree(r1.getResponse().getContentAsString()).get("id").asText();
        String id2 = objectMapper.readTree(r2.getResponse().getContentAsString()).get("id").asText();
        assertThat(id1).isEqualTo(id2);
    }

    @Test
    void start_patient_thread_creates_with_members() throws Exception {
        UUID patientId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO patient_patient (id, last_name, first_name, version, number_children,
                    status, created_at, updated_at)
                VALUES (?, 'Alami', 'Mohamed', 0, 0, 'ACTIF', now(), now())
                """, patientId);

        String auth = bearer(medId);
        MvcResult r = mockMvc.perform(post("/api/chat/patient-threads")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"patientId\":\"" + patientId + "\",\"subject\":\"Suivi HTA\","
                                + "\"participantIds\":[\"" + secId + "\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kind").value("PATIENT_THREAD"))
                .andReturn();
        String convId = objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();

        Integer memberCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM chat_conversation_member WHERE conversation_id = ?::uuid",
                Integer.class, convId);
        assertThat(memberCount).isEqualTo(2); // creator + sec
    }

    @Test
    void read_receipt_visible_to_sender_after_recipient_marks_read() throws Exception {
        String medAuth = bearer(medId);
        String secAuth = bearer(secId);
        MvcResult dm = mockMvc.perform(post("/api/chat/direct-messages")
                        .header("Authorization", medAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"otherUserId\":\"" + secId + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String dmId = objectMapper.readTree(dm.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/chat/conversations/" + dmId + "/messages")
                        .header("Authorization", medAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"yo\"}"))
                .andExpect(status().isOk());

        // avant mark-read
        MvcResult before = mockMvc.perform(get("/api/chat/conversations/" + dmId + "/messages")
                        .header("Authorization", medAuth))
                .andExpect(status().isOk()).andReturn();
        assertThat(objectMapper.readTree(before.getResponse().getContentAsString())
                .get(0).get("readByRecipient").asBoolean()).isFalse();

        mockMvc.perform(post("/api/chat/conversations/" + dmId + "/mark-read")
                        .header("Authorization", secAuth))
                .andExpect(status().isNoContent());

        MvcResult after = mockMvc.perform(get("/api/chat/conversations/" + dmId + "/messages")
                        .header("Authorization", medAuth))
                .andExpect(status().isOk()).andReturn();
        assertThat(objectMapper.readTree(after.getResponse().getContentAsString())
                .get(0).get("readByRecipient").asBoolean()).isTrue();
    }

    @Test
    void non_member_cannot_access_conversation() throws Exception {
        String medAuth = bearer(medId);
        String asstAuth = bearer(asstId);
        MvcResult dm = mockMvc.perform(post("/api/chat/direct-messages")
                        .header("Authorization", medAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"otherUserId\":\"" + secId + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String dmId = objectMapper.readTree(dm.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(get("/api/chat/conversations/" + dmId + "/messages")
                        .header("Authorization", asstAuth))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/chat/conversations/" + dmId + "/messages")
                        .header("Authorization", asstAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"intrusion\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/chat/conversations/" + dmId + "/mark-read")
                        .header("Authorization", asstAuth))
                .andExpect(status().isNotFound());
    }

    @Test
    void unread_count_aggregates_channels_and_dms() throws Exception {
        String medAuth = bearer(medId);
        String secAuth = bearer(secId);

        // sec auto-join canaux
        mockMvc.perform(get("/api/chat/channels").header("Authorization", secAuth))
                .andExpect(status().isOk());

        // med envoie 2 msgs en canal + 1 DM à sec
        String channelId = firstChannelId(medAuth);
        sendMessage(medAuth, channelId, "channel1");
        sendMessage(medAuth, channelId, "channel2");

        MvcResult dm = mockMvc.perform(post("/api/chat/direct-messages")
                        .header("Authorization", medAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"otherUserId\":\"" + secId + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String dmId = objectMapper.readTree(dm.getResponse().getContentAsString()).get("id").asText();
        sendMessage(medAuth, dmId, "dm1");

        mockMvc.perform(get("/api/chat/unread-count").header("Authorization", secAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(3));
    }

    // QA9-2 (suivi .xlsx 2026-05-26) — « le nombre de messages affiché dans le menu
    // ne se décrémente pas quand les messages sont lus ». Ce test verrouille le contrat
    // backend : après mark-read d'une conversation, unread-count retombe à 0.
    @Test
    void unread_count_decrements_after_mark_read() throws Exception {
        String medAuth = bearer(medId);
        String secAuth = bearer(secId);

        // med ouvre un DM vers sec et y envoie 2 messages → sec a 2 non-lus.
        MvcResult dm = mockMvc.perform(post("/api/chat/direct-messages")
                        .header("Authorization", medAuth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"otherUserId\":\"" + secId + "\"}"))
                .andExpect(status().isOk()).andReturn();
        String dmId = objectMapper.readTree(dm.getResponse().getContentAsString()).get("id").asText();
        sendMessage(medAuth, dmId, "non lu 1");
        sendMessage(medAuth, dmId, "non lu 2");

        mockMvc.perform(get("/api/chat/unread-count").header("Authorization", secAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(2));

        // sec lit la conversation (mark-read).
        mockMvc.perform(post("/api/chat/conversations/" + dmId + "/mark-read")
                        .header("Authorization", secAuth))
                .andExpect(status().isNoContent());

        // Le compteur doit être retombé à 0 — c'est la décrémentation attendue.
        mockMvc.perform(get("/api/chat/unread-count").header("Authorization", secAuth))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0));
    }

    @Test
    void unauthenticated_returns_401() throws Exception {
        mockMvc.perform(get("/api/chat/channels"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/chat/unread-count"))
                .andExpect(status().isUnauthorized());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // helpers
    // ─────────────────────────────────────────────────────────────────────────

    private String firstChannelId(String auth) throws Exception {
        MvcResult chans = mockMvc.perform(get("/api/chat/channels").header("Authorization", auth))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(chans.getResponse().getContentAsString())
                .get(0).get("id").asText();
    }

    private String sendMessage(String auth, String convId, String body) throws Exception {
        MvcResult r = mockMvc.perform(post("/api/chat/conversations/" + convId + "/messages")
                        .header("Authorization", auth)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"" + body + "\"}"))
                .andExpect(status().isOk()).andReturn();
        return objectMapper.readTree(r.getResponse().getContentAsString()).get("id").asText();
    }
}
