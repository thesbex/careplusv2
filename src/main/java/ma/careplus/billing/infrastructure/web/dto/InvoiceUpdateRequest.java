package ma.careplus.billing.infrastructure.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import java.math.BigDecimal;
import java.util.List;

public record InvoiceUpdateRequest(
        @Valid List<InvoiceLineRequest> lines,
        @DecimalMin("0") BigDecimal discountAmount
) {}
