package ma.careplus.hospitalization.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** Payloads de création / mise à jour d'un lit. */
public final class BedRequests {

    private BedRequests() {}

    /** Statuts settables manuellement (OCCUPE est calculé, jamais posé à la main). */
    private static final String MANUAL_STATUS_REGEX = "LIBRE|RESERVE|NETTOYAGE|HORS_SERVICE";

    public record CreateBedRequest(
            @NotNull UUID roomId,
            @NotBlank @Size(max = 32) String code) {}

    public record UpdateBedRequest(
            @NotBlank @Size(max = 32) String code,
            Boolean active) {}

    public record UpdateBedStatusRequest(
            @NotBlank @Pattern(regexp = MANUAL_STATUS_REGEX) String status) {}
}
