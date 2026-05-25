package ma.careplus.hospitalization.infrastructure.web.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Tableau des lits — vue hiérarchique service → chambre → lits, pour l'écran
 * central de l'hospitalisation. En Slice A l'occupation reflète l'état manuel
 * du lit ; l'occupation réelle (depuis les séjours) viendra en Slice B.
 */
public record BedBoardView(List<WardBoard> wards) {

    public record WardBoard(
            UUID wardId,
            String wardCode,
            String wardLabel,
            List<RoomBoard> rooms) {}

    public record RoomBoard(
            UUID roomId,
            String roomCode,
            String roomLabel,
            String roomClass,
            BigDecimal dailyRate,
            List<BedView> beds) {}
}
