package ma.careplus.patient.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.UUID;

public record AntecedentView(
        UUID id,
        String type,
        String description,
        LocalDate occurredOn,
        String category
) {}
