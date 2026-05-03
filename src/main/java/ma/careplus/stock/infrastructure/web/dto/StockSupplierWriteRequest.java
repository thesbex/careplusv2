package ma.careplus.stock.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Write DTO for creating or updating a stock supplier.
 */
public record StockSupplierWriteRequest(

        @NotBlank
        @Size(max = 200)
        String name,

        @Size(max = 50)
        String phone
) {}
