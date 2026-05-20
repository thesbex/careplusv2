package ma.careplus.identity.infrastructure.web.dto;

import java.time.OffsetDateTime;
import java.util.UUID;
import ma.careplus.identity.domain.ReferralContact;

public record ReferralContactView(
        UUID id,
        String fullName,
        String specialty,
        String phone,
        String city,
        String notes,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
    public static ReferralContactView of(ReferralContact c) {
        return new ReferralContactView(
                c.getId(),
                c.getFullName(),
                c.getSpecialty(),
                c.getPhone(),
                c.getCity(),
                c.getNotes(),
                c.getCreatedAt(),
                c.getUpdatedAt());
    }
}
