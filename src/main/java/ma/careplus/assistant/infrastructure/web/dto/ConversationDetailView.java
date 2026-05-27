package ma.careplus.assistant.infrastructure.web.dto;

import java.util.List;
import java.util.UUID;

/** Détail d'une conversation : en-tête + fil complet des messages. */
public record ConversationDetailView(
        UUID id, String title, UUID patientId, List<AssistantMessageView> messages) {}
