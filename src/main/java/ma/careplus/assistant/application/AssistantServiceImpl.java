package ma.careplus.assistant.application;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import ma.careplus.assistant.application.AiChatClient.AiChatResult;
import ma.careplus.assistant.application.AiChatClient.AiMessage;
import ma.careplus.assistant.infrastructure.web.dto.AiConfigView;
import ma.careplus.assistant.infrastructure.web.dto.AskRequest;
import ma.careplus.assistant.infrastructure.web.dto.AssistantMessageView;
import ma.careplus.assistant.infrastructure.web.dto.ConversationDetailView;
import ma.careplus.assistant.infrastructure.web.dto.ConversationSummaryView;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implémentation JdbcTemplate (pattern dashboard/chat — pas d'entité JPA pour
 * deux tables append-only). Le contexte patient est assemblé par lecture
 * cross-module en SQL (sans importer les repositories du module patient).
 */
@Service
public class AssistantServiceImpl implements AssistantService {

    private final JdbcTemplate jdbc;
    private final AiChatClient ai;
    private final AiProperties props;

    public AssistantServiceImpl(JdbcTemplate jdbc, AiChatClient ai, AiProperties props) {
        this.jdbc = jdbc;
        this.ai = ai;
        this.props = props;
    }

    @Override
    public AiConfigView config() {
        return new AiConfigView(props.isEnabled(), ai.isConfigured(), ai.provider(), ai.model());
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConversationSummaryView> listConversations(UUID ownerId) {
        return jdbc.query("""
                SELECT id, title, patient_id, updated_at
                  FROM assistant_conversation
                 WHERE owner_id = ?
                 ORDER BY updated_at DESC
                """,
                (rs, i) -> new ConversationSummaryView(
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        rs.getObject("patient_id", UUID.class),
                        rs.getObject("updated_at", OffsetDateTime.class)),
                ownerId);
    }

    @Override
    @Transactional(readOnly = true)
    public ConversationDetailView getConversation(UUID ownerId, UUID conversationId) {
        ConversationRow conv = requireOwnedConversation(ownerId, conversationId);
        return new ConversationDetailView(conv.id, conv.title, conv.patientId, loadMessages(conv.id));
    }

    @Override
    @Transactional
    public ConversationDetailView ask(UUID ownerId, AskRequest req) {
        if (!ai.isConfigured()) {
            throw new BusinessException("AI-001",
                    "Assistant IA non configuré : aucune clé API renseignée.", 503);
        }

        UUID conversationId;
        UUID patientId;
        if (req.conversationId() == null) {
            conversationId = UUID.randomUUID();
            patientId = req.patientId();
            jdbc.update("""
                    INSERT INTO assistant_conversation (id, owner_id, patient_id, title)
                    VALUES (?, ?, ?, ?)
                    """,
                    conversationId, ownerId, patientId, deriveTitle(req.message()));
        } else {
            ConversationRow conv = requireOwnedConversation(ownerId, req.conversationId());
            conversationId = conv.id;
            patientId = conv.patientId; // le contexte patient est figé à la création
        }

        // 1) persiste la question
        insertMessage(conversationId, "USER", req.message());

        // 2) construit le prompt : system + (contexte patient) + historique
        List<AiMessage> prompt = new ArrayList<>();
        prompt.add(new AiMessage("system", props.getSystemPrompt()));
        if (patientId != null) {
            String context = buildPatientContext(patientId);
            if (context != null) {
                prompt.add(new AiMessage("system",
                        "Contexte du dossier patient (résumé clinique, à utiliser pour ta réponse) :\n"
                                + context));
            }
        }
        for (AssistantMessageView m : loadMessages(conversationId)) {
            prompt.add(new AiMessage(m.role().toLowerCase(), m.content()));
        }

        // 3) interroge le modèle + persiste la réponse
        AiChatResult result = ai.complete(prompt);
        insertMessage(conversationId, "ASSISTANT", result.content());

        jdbc.update("UPDATE assistant_conversation SET updated_at = now() WHERE id = ?", conversationId);

        ConversationRow conv = requireOwnedConversation(ownerId, conversationId);
        return new ConversationDetailView(conv.id, conv.title, conv.patientId, loadMessages(conversationId));
    }

    @Override
    @Transactional
    public void deleteConversation(UUID ownerId, UUID conversationId) {
        requireOwnedConversation(ownerId, conversationId);
        jdbc.update("DELETE FROM assistant_conversation WHERE id = ?", conversationId);
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    private record ConversationRow(UUID id, String title, UUID patientId) {}

    private ConversationRow requireOwnedConversation(UUID ownerId, UUID conversationId) {
        List<ConversationRow> rows = jdbc.query("""
                SELECT id, title, patient_id
                  FROM assistant_conversation
                 WHERE id = ? AND owner_id = ?
                """,
                (rs, i) -> new ConversationRow(
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        rs.getObject("patient_id", UUID.class)),
                conversationId, ownerId);
        if (rows.isEmpty()) {
            throw new NotFoundException("AI-404", "Conversation introuvable.");
        }
        return rows.get(0);
    }

    private List<AssistantMessageView> loadMessages(UUID conversationId) {
        return jdbc.query("""
                SELECT id, role, content, created_at
                  FROM assistant_message
                 WHERE conversation_id = ? AND role <> 'SYSTEM'
                 ORDER BY created_at, id
                """,
                (rs, i) -> new AssistantMessageView(
                        rs.getObject("id", UUID.class),
                        rs.getString("role"),
                        rs.getString("content"),
                        rs.getObject("created_at", OffsetDateTime.class)),
                conversationId);
    }

    private void insertMessage(UUID conversationId, String role, String content) {
        // clock_timestamp() (et non now(), figé à l'ouverture de la transaction)
        // pour que USER et ASSISTANT, insérés dans la même transaction, gardent
        // un ordre chronologique strict.
        jdbc.update("""
                INSERT INTO assistant_message (id, conversation_id, role, content, created_at)
                VALUES (?, ?, ?, ?, clock_timestamp())
                """,
                UUID.randomUUID(), conversationId, role, content);
    }

    private static String deriveTitle(String message) {
        String firstLine = message.strip().lines().findFirst().orElse(message).strip();
        if (firstLine.length() > 80) {
            return firstLine.substring(0, 79) + "…";
        }
        return firstLine.isBlank() ? "Nouvelle conversation" : firstLine;
    }

    /**
     * Assemble un résumé clinique anonymisant du dossier patient pour l'IA.
     * On exclut volontairement les identifiants directs (CIN, téléphone,
     * adresse, nom de famille) — seules les données cliniquement utiles sont
     * transmises au fournisseur IA.
     */
    private String buildPatientContext(UUID patientId) {
        List<String> p = jdbc.query("""
                SELECT first_name, gender, birth_date, blood_group
                  FROM patient_patient
                 WHERE id = ? AND deleted_at IS NULL
                """,
                (rs, i) -> {
                    StringBuilder sb = new StringBuilder();
                    sb.append("Prénom : ").append(rs.getString("first_name")).append('\n');
                    String gender = rs.getString("gender");
                    sb.append("Sexe : ").append(gender == null ? "?" : gender).append('\n');
                    LocalDate birth = rs.getObject("birth_date", LocalDate.class);
                    if (birth != null) {
                        sb.append("Âge : ").append(Period.between(birth, LocalDate.now()).getYears())
                                .append(" ans\n");
                    }
                    String blood = rs.getString("blood_group");
                    if (blood != null && !blood.isBlank()) {
                        sb.append("Groupe sanguin : ").append(blood).append('\n');
                    }
                    return sb.toString();
                },
                patientId);
        if (p.isEmpty()) {
            return null; // patient inexistant ou supprimé
        }
        StringBuilder ctx = new StringBuilder(p.get(0));

        List<String> allergies = jdbc.query("""
                SELECT substance, severity FROM patient_allergy
                 WHERE patient_id = ? ORDER BY created_at
                """,
                (rs, i) -> "- " + rs.getString("substance") + " (" + rs.getString("severity") + ")",
                patientId);
        ctx.append("\nAllergies : ")
                .append(allergies.isEmpty() ? "aucune connue" : "\n" + String.join("\n", allergies))
                .append('\n');

        List<String> antecedents = jdbc.query("""
                SELECT type, description FROM patient_antecedent
                 WHERE patient_id = ? ORDER BY created_at
                """,
                (rs, i) -> "- [" + rs.getString("type") + "] " + rs.getString("description"),
                patientId);
        ctx.append("\nAntécédents : ")
                .append(antecedents.isEmpty() ? "aucun renseigné" : "\n" + String.join("\n", antecedents))
                .append('\n');

        List<String> vitals = jdbc.query("""
                SELECT systolic_mmhg, diastolic_mmhg, temperature_c, weight_kg, height_cm,
                       heart_rate_bpm, glycemia_g_per_l, recorded_at
                  FROM clinical_vital_signs
                 WHERE patient_id = ?
                 ORDER BY recorded_at DESC
                 LIMIT 3
                """,
                (rs, i) -> {
                    StringBuilder v = new StringBuilder("- ");
                    LocalDate d = rs.getObject("recorded_at", OffsetDateTime.class).toLocalDate();
                    v.append(d).append(" : ");
                    Integer sys = (Integer) rs.getObject("systolic_mmhg");
                    Integer dia = (Integer) rs.getObject("diastolic_mmhg");
                    if (sys != null && dia != null) v.append("TA ").append(sys).append('/').append(dia).append(" ");
                    Object temp = rs.getObject("temperature_c");
                    if (temp != null) v.append("T ").append(temp).append("°C ");
                    Object w = rs.getObject("weight_kg");
                    if (w != null) v.append("Poids ").append(w).append("kg ");
                    Integer hr = (Integer) rs.getObject("heart_rate_bpm");
                    if (hr != null) v.append("FC ").append(hr).append("bpm ");
                    Object gly = rs.getObject("glycemia_g_per_l");
                    if (gly != null) v.append("Glycémie ").append(gly).append("g/L");
                    return v.toString().strip();
                },
                patientId);
        if (!vitals.isEmpty()) {
            ctx.append("\nDernières constantes :\n").append(String.join("\n", vitals)).append('\n');
        }

        List<String> consults = jdbc.query("""
                SELECT started_at, motif, diagnosis FROM clinical_consultation
                 WHERE patient_id = ? AND status <> 'BROUILLON'
                 ORDER BY started_at DESC
                 LIMIT 3
                """,
                (rs, i) -> {
                    LocalDate d = rs.getObject("started_at", OffsetDateTime.class).toLocalDate();
                    String motif = rs.getString("motif");
                    String diag = rs.getString("diagnosis");
                    StringBuilder c = new StringBuilder("- ").append(d).append(" : ");
                    if (motif != null && !motif.isBlank()) c.append("motif « ").append(motif.strip()).append(" »");
                    if (diag != null && !diag.isBlank()) c.append(" — dg « ").append(diag.strip()).append(" »");
                    return c.toString();
                },
                patientId);
        if (!consults.isEmpty()) {
            ctx.append("\nConsultations récentes :\n").append(String.join("\n", consults)).append('\n');
        }

        return ctx.toString();
    }
}
