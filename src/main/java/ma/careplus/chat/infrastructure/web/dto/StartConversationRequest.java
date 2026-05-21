package ma.careplus.chat.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record StartConversationRequest(@NotNull UUID otherUserId) {}
