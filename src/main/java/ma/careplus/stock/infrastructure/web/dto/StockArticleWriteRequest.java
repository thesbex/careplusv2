package ma.careplus.stock.infrastructure.web.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import ma.careplus.stock.domain.StockArticleCategory;

/**
 * Write DTO for creating or updating a stock article.
 */
public record StockArticleWriteRequest(

        @NotBlank
        @Size(max = 64)
        @Pattern(regexp = "[A-Z0-9_\\-]+", message = "Le code doit être en majuscules alphanumériques")
        String code,

        @NotBlank
        @Size(max = 200)
        String label,

        @NotNull
        StockArticleCategory category,

        @NotBlank
        @Size(max = 32)
        String unit,

        @Min(0)
        int minThreshold,

        UUID supplierId,

        @Size(max = 200)
        String location
) {}
