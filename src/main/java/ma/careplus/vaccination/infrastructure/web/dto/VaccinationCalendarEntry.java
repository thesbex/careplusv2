package ma.careplus.vaccination.infrastructure.web.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccinationCalendarStatus;
import ma.careplus.vaccination.domain.VaccinationRoute;

/**
 * Unified calendar entry returned by GET /api/patients/{id}/vaccinations.
 *
 * <ul>
 *   <li>{@code id} is null when the dose is computed at runtime and not yet materialised in DB.</li>
 *   <li>{@code scheduleDoseId} is null for off-schedule (catch-up) doses.</li>
 *   <li>{@code administeredAt}, {@code lotNumber}, {@code route}, {@code site},
 *       {@code administeredByName}, {@code deferralReason}, {@code notes}, {@code version}
 *       are null for computed-only entries.</li>
 * </ul>
 */
public record VaccinationCalendarEntry(
        UUID id,
        UUID scheduleDoseId,
        UUID vaccineId,
        String vaccineCode,
        String vaccineName,
        int doseNumber,
        String doseLabel,
        LocalDate targetDate,
        int toleranceDays,
        VaccinationCalendarStatus status,
        OffsetDateTime administeredAt,
        String lotNumber,
        VaccinationRoute route,
        String site,
        String administeredByName,
        String deferralReason,
        String notes,
        Long version
) {}
