package ma.careplus.assistant.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

/** Un message du fil (role = USER | ASSISTANT ; SYSTEM n'est jamais exposé). */
public record AssistantMessageView(UUID id, String role, String content, OffsetDateTime createdAt) {}
