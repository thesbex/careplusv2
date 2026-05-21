package ma.careplus.chat.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record PinRequest(@NotNull UUID messageId) {}
