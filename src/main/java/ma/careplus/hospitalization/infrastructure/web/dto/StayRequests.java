package ma.careplus.hospitalization.infrastructure.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Payloads du cycle de vie d'un séjour. */
public final class StayRequests {

    private StayRequests() {}

    public record AdmitRequest(
            @NotNull UUID patientId,
            @NotNull UUID bedId,
            UUID attendingPractitionerId,
            @Size(max = 2000) String admissionReason) {}

    public record TransferRequest(@NotNull UUID bedId) {}

    public record DischargeRequest(
            @NotNull @Pattern(regexp = "DOMICILE|TRANSFERT_EXT|CONTRE_AVIS|DECES") String dischargeType,
            @Size(max = 5000) String dischargeSummary) {}
}
