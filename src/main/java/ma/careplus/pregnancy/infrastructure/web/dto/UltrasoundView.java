package ma.careplus.pregnancy.infrastructure.web.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.pregnancy.domain.UltrasoundKind;

/**
 * Read-only projection of a {@code PregnancyUltrasound} returned by the API.
 */
public record UltrasoundView(
        UUID id,
        UUID pregnancyId,
        UltrasoundKind kind,
        LocalDate performedAt,
        short saWeeksAtExam,
        short saDaysAtExam,
        String findings,
        UUID documentId,
        String biometryJson,
        boolean correctsDueDate,
        UUID recordedBy,
        long version,
        OffsetDateTime createdAt
) {}
