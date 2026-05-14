package ma.careplus.patient.infrastructure.web.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Rich row for the patients list screen (05a). Adds aggregates the dense table
 * needs: last visit, next appointment, chronic/allergy/pregnant flags, and a
 * short tag list (chronic antecedent descriptions, then "Grossesse · S<weeks>"
 * if pregnant) — capped at 3 in the service so the column stays compact.
 *
 * Kept separate from {@link PatientSummary} which is reused by the prise-RDV
 * spotlight + dossier header — those callers don't need (or pay for) the
 * cross-module joins.
 */
public record PatientListItemView(
        UUID id,
        String firstName,
        String lastName,
        String gender,
        LocalDate birthDate,
        String cin,
        String phone,
        String city,
        String status,
        String tier,
        UUID photoDocumentId,
        OffsetDateTime createdAt,
        OffsetDateTime lastVisitAt,
        OffsetDateTime nextAppointmentAt,
        boolean chronic,
        boolean allergy,
        boolean pregnant,
        boolean isNew,
        List<String> tags
) {}
