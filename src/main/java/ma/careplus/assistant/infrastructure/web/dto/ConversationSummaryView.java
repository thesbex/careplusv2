package ma.careplus.assistant.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Ligne de la liste « mes conversations » (rail gauche). */
public record ConversationSummaryView(
        UUID id, String title, UUID patientId, OffsetDateTime updatedAt) {}
