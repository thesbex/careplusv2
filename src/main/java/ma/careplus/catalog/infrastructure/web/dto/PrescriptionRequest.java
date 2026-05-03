package ma.careplus.catalog.infrastructure.web.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record PrescriptionRequest(
        @NotNull String type,
        @Valid List<PrescriptionLineRequest> lines,
        boolean allergyOverride,
        String allergyOverrideReason
) {}
