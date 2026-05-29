package ma.careplus.hospitalization.infrastructure.web.dto;

import java.time.Instant;
import java.util.UUID;

/** Ligne de la worklist « Patients hospitalisés » (séjours EN_COURS). */
public record StayQueueEntry(
        UUID stayId,
        UUID patientId,
        String patientFirstName,
        String patientLastName,
        String admissionReason,
        Instant admittedAt,
        int daysSoFar,
        UUID bedId,
        String bedLabel,
        String wardLabel,
        UUID attendingPractitionerId) {}
