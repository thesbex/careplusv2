package ma.careplus.caisse.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import ma.careplus.billing.domain.PaymentMode;
import ma.careplus.caisse.infrastructure.web.dto.CaisseModeAmount;
import ma.careplus.caisse.infrastructure.web.dto.CaisseSummaryResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Caisse quotidienne — agrégation à la volée des encaissements de la journée.
 *
 * Variante A : aucune table dédiée. La caisse "se réinitialise" naturellement
 * chaque jour parce que la requête est bornée à `[date 00:00:00, date+1 00:00:00[`
 * dans la TZ Africa/Casablanca. Pas de notion d'ouverture/clôture (Z) — c'est
 * un simple tableau de bord live.
 */
@Service
public class CaisseService {

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public CaisseService(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CaisseSummaryResponse summarize(LocalDate date) {
        LocalDate target = date != null ? date : LocalDate.now(clock);

        // Bornes du jour en TZ Africa/Casablanca (déjà la TZ JVM par Application.java).
        OffsetDateTime start = target.atStartOfDay(clock.getZone()).toOffsetDateTime();
        OffsetDateTime end = target.plusDays(1).atStartOfDay(clock.getZone()).toOffsetDateTime();

        // Agrégat des paiements par mode. On ignore les paiements rattachés à une
        // facture annulée par avoir ultérieur ? — Décision : non, les paiements
        // existent indépendamment, et le rapport caisse doit refléter ce qui est
        // physiquement encaissé dans la journée. Un avoir émis le lendemain ne
        // change pas la caisse de la veille.
        Map<PaymentMode, BigDecimal> sumByMode = new EnumMap<>(PaymentMode.class);
        Map<PaymentMode, Long> countByMode = new EnumMap<>(PaymentMode.class);

        jdbc.query("""
                SELECT method, COALESCE(SUM(amount), 0) AS total, COUNT(*) AS cnt
                FROM billing_payment
                WHERE received_at >= ? AND received_at < ?
                GROUP BY method
                """, rs -> {
            String methodStr = rs.getString("method");
            try {
                PaymentMode mode = PaymentMode.valueOf(methodStr);
                sumByMode.put(mode, rs.getBigDecimal("total"));
                countByMode.put(mode, rs.getLong("cnt"));
            } catch (IllegalArgumentException ignored) {
                // mode legacy non mappé → ignoré
            }
        }, start, end);

        // Lignes par mode (toujours toutes les modes, à zéro si rien encaissé).
        List<CaisseModeAmount> byMode = new ArrayList<>();
        for (PaymentMode m : PaymentMode.values()) {
            byMode.add(new CaisseModeAmount(
                    m,
                    sumByMode.getOrDefault(m, BigDecimal.ZERO),
                    countByMode.getOrDefault(m, 0L)));
        }

        BigDecimal total = sumByMode.values().stream()
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long count = countByMode.values().stream().mapToLong(Long::longValue).sum();

        // Factures émises le jour (statut != BROUILLON, issued_at dans la fenêtre).
        Map<String, Object> issued = jdbc.queryForMap("""
                SELECT COALESCE(SUM(net_amount), 0) AS total, COUNT(*) AS cnt
                FROM billing_invoice
                WHERE issued_at >= ? AND issued_at < ?
                """, start, end);

        BigDecimal invoicesTotal = (BigDecimal) issued.get("total");
        long invoicesCount = ((Number) issued.get("cnt")).longValue();

        return new CaisseSummaryResponse(
                target, total, count, byMode, invoicesTotal, invoicesCount);
    }
}
