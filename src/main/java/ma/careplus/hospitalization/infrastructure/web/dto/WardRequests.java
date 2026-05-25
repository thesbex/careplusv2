package ma.careplus.hospitalization.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Payloads de création / mise à jour d'un service d'hospitalisation. */
public final class WardRequests {

    private WardRequests() {}

    public record CreateWardRequest(
            @NotBlank @Size(max = 32) String code,
            @NotBlank @Size(max = 120) String labelFr) {}

    public record UpdateWardRequest(
            @NotBlank @Size(max = 32) String code,
            @NotBlank @Size(max = 120) String labelFr,
            Boolean active) {}
}
