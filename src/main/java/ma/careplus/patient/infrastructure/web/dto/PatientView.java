package ma.careplus.patient.infrastructure.web.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/** Full patient record returned by GET /api/patients/{id}. */
public record PatientView(
        UUID id,
        String firstName,
        String lastName,
        String gender,
        LocalDate birthDate,
        String cin,
        String phone,
        String emergencyPhone,
        String email,
        String address,
        String city,
        String country,
        String maritalStatus,
        String profession,
        String bloodGroup,
        int numberChildren,
        String notes,
        String status,
        String tier,
        UUID mutuelleInsuranceId,
        String mutuellePoliceNumber,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        List<AllergyView> allergies,
        List<AntecedentView> antecedents
) {}
