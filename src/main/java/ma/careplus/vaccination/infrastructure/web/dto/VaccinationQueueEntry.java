package ma.careplus.vaccination.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccinationCalendarStatus;

/**
 * A single row in the cross-patient vaccination worklist.
 *
 * <ul>
 *   <li>{@code patientPhotoDocumentId} is nullable (patient may not have a photo).</li>
 *   <li>{@code daysOverdue} is positive when overdue, negative when the dose is upcoming.</li>
 *   <li>{@code ageMonths} is computed from birthDate to today.</li>
 * </ul>
 */
public record VaccinationQueueEntry(
        UUID patientId,
        String patientFullName,
        UUID patientPhotoDocumentId,
        LocalDate birthDate,
        int ageMonths,
        String vaccineCode,
        String vaccineName,
        int doseNumber,
        String doseLabel,
        LocalDate targetDate,
        int daysOverdue,
        VaccinationCalendarStatus status
) {}
