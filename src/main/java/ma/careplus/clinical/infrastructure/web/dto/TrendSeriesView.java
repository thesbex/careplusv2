package ma.careplus.clinical.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Une série du graphe d'évolution biologique d'un patient. Une série =
 * tous les points d'un même analyte (ex. "Hb") triés par date.
 */
public record TrendSeriesView(
        /** Libellé affichable de l'analyte (premier orthographe enregistré). */
        String analyte,
        /** Unité majoritaire pour la série (peut varier d'un point à l'autre, on prend celle la plus récente). */
        String unit,
        List<Point> points
) {
    public record Point(OffsetDateTime recordedAt, BigDecimal value, String unit) {}
}
