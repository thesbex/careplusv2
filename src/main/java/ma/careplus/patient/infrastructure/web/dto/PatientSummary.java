package ma.careplus.patient.infrastructure.web.dto;

import java.time.LocalDate;
import java.util.UUID;

/** Lighter view for search results and lists — no nested collections. */
public record PatientSummary(
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
        /** ID du document patient_document type=PHOTO courant. QA5-3 — sert à afficher l'avatar dans la liste. */
        UUID photoDocumentId
) {}
