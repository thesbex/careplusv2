package ma.careplus.hospitalization.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.UUID;

/** Vue d'une chambre. {@code dailyRate} = prix de journée (MAD). */
public record RoomView(
        UUID id,
        UUID wardId,
        String code,
        String labelFr,
        String roomClass,
        BigDecimal dailyRate,
        boolean active) {}
