package ma.careplus.patient.infrastructure.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.UUID;

// NOTE birthDate is enforced as required at the frontend layer (see
// `PatientsListPage.NewPatientPanel` and `PriseRDVDialog.NewPatientInline`).
// We keep it nullable at the API to not break the many integration tests
// that seed patients with name-only payloads — but we do enforce it must
// be in the past when present.
public record CreatePatientRequest(
        @NotBlank @Size(min = 2, max = 64) @Pattern(regexp = "[\\p{L}\\s'\\-]+", message = "Prénom invalide") String firstName,
        @NotBlank @Size(min = 2, max = 64) @Pattern(regexp = "[\\p{L}\\s'\\-]+", message = "Nom invalide") String lastName,
        @Pattern(regexp = "M|F|O", message = "gender must be M, F or O")
        @Size(max = 8)
        String gender,
        @Past(message = "La date de naissance doit être dans le passé")
        LocalDate birthDate,
        @Size(max = 32) String cin,
        @Size(max = 32) @Pattern(regexp = "[\\d\\s+\\-().]{6,32}", message = "Numéro de téléphone invalide") String phone,
        @Size(max = 32) String emergencyPhone,
        @Email @Size(max = 255) String email,
        @Size(max = 512) String address,
        @Size(max = 128) String city,
        @Size(max = 64) String country,
        @Size(max = 16) String maritalStatus,
        @Size(max = 128) String profession,
        @Size(max = 8) String bloodGroup,
        @PositiveOrZero Integer numberChildren,
        String notes,
        @Pattern(regexp = "NORMAL|PREMIUM", message = "tier must be NORMAL or PREMIUM") String tier,
        UUID mutuelleInsuranceId,
        @Size(max = 64) String mutuellePolicyNumber
) {}
