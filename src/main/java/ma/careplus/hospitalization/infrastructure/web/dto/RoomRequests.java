package ma.careplus.hospitalization.infrastructure.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.UUID;

/** Payloads de création / mise à jour d'une chambre. */
public final class RoomRequests {

    private RoomRequests() {}

    private static final String CLASS_REGEX = "INDIVIDUELLE|DOUBLE|COMMUNE|SUITE|AUTRE";

    public record CreateRoomRequest(
            @NotNull UUID wardId,
            @NotBlank @Size(max = 32) String code,
            @NotBlank @Size(max = 120) String labelFr,
            @NotBlank @Pattern(regexp = CLASS_REGEX) String roomClass,
            @NotNull @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal dailyRate) {}

    public record UpdateRoomRequest(
            @NotBlank @Size(max = 32) String code,
            @NotBlank @Size(max = 120) String labelFr,
            @NotBlank @Pattern(regexp = CLASS_REGEX) String roomClass,
            @NotNull @DecimalMin("0.00") @Digits(integer = 8, fraction = 2) BigDecimal dailyRate,
            Boolean active) {}
}
