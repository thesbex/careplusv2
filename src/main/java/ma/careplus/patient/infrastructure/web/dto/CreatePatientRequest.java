package ma.careplus.patient.infrastructure.web.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreatePatientRequest(
        @NotBlank @Size(max = 64) String firstName,
        @NotBlank @Size(max = 64) String lastName,
        @Pattern(regexp = "M|F|O", message = "gender must be M, F or O")
        @Size(max = 8)
        String gender,
        LocalDate birthDate,
        @Size(max = 32) String cin,
        @Size(max = 32) String phone,
        @Size(max = 32) String emergencyPhone,
        @Email @Size(max = 255) String email,
        @Size(max = 512) String address,
        @Size(max = 128) String city,
        @Size(max = 64) String country,
        @Size(max = 16) String maritalStatus,
        @Size(max = 128) String profession,
        @Size(max = 8) String bloodGroup,
        @PositiveOrZero Integer numberChildren,
        String notes
) {}
