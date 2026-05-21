package ma.careplus.chat.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReactionRequest(@NotBlank @Size(min = 1, max = 16) String emoji) {}
