package ma.careplus.pregnancy.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.UUID;
import ma.careplus.pregnancy.domain.DueDateSource;
import ma.careplus.pregnancy.domain.PregnancyOutcome;
import ma.careplus.pregnancy.domain.PregnancyStatus;

/**
 * Read-only view of a pregnancy returned by API responses.
 *
 * <p>Computed fields:
 * <ul>
 *   <li>{@code saWeeks} — current gestational age in weeks (floor), null when closed.</li>
 *   <li>{@code gravidity} — total number of pregnancies for this patient.</li>
 *   <li>{@code parity} — number of pregnancies that resulted in ACCOUCHEMENT_VIVANT or MORT_NEE.</li>
 * </ul>
 * These are filled by the mapper from service-computed values.
 */
public record PregnancyView(
        UUID id,
        UUID patientId,
        LocalDate lmpDate,
        LocalDate dueDate,
        DueDateSource dueDateSource,
        PregnancyStatus status,
        LocalDate startedAt,
        LocalDate endedAt,
        PregnancyOutcome outcome,
        UUID childPatientId,
        String fetusesJson,
        String notes,
        long version,
        /** Gestational age in full weeks at today's date (null when pregnancy is closed). */
        Integer saWeeks,
        /** Days remainder of gestational age (0-6). Null when pregnancy is closed. */
        Integer saDays,
        /** Total number of pregnancies (including this one) for the patient. */
        int gravidity,
        /** Number of deliveries resulting in live birth or stillbirth. */
        int parity
) {}
