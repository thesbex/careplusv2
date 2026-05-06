package ma.careplus.dashboard.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import ma.careplus.dashboard.infrastructure.web.dto.FinancialDashboardView;
import ma.careplus.dashboard.infrastructure.web.dto.FinancialDashboardView.ActeBreakdown;
import ma.careplus.dashboard.infrastructure.web.dto.FinancialDashboardView.MonthAmount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Native-SQL implementation of {@link FinancialDashboardService}.
 *
 * <p>Cross-module read on {@code billing_invoice} + {@code billing_invoice_line}
 * + {@code catalog_act}. No writes. Computes all aggregates in 4 SQL roundtrips
 * (single-row CA windows, 12-month timeline, top-10 acte breakdown,
 * impayés counters) to stay fast even with thousands of invoices.
 *
 * <p>Encaissé = status IN (PAYEE_TOTALE, PAYEE_PARTIELLE). Impayés = status =
 * EMISE. ANNULEE / BROUILLON ignored.
 *
 * <p>Time windows are computed in Africa/Casablanca then converted to UTC
 * {@link OffsetDateTime} for the {@code issued_at TIMESTAMPTZ} comparisons.
 */
@Service
public class FinancialDashboardServiceImpl implements FinancialDashboardService {

    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");
    private static final int ACTE_TOP_N = 10;

    private final JdbcTemplate jdbc;

    public FinancialDashboardServiceImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public FinancialDashboardView getFinancialDashboard() {
        LocalDate today = LocalDate.now(CASA);
        YearMonth currentMonth = YearMonth.from(today);
        YearMonth previousMonth = currentMonth.minusMonths(1);

        OffsetDateTime startOfDay = today.atStartOfDay(CASA).toOffsetDateTime();
        OffsetDateTime startOfTomorrow = today.plusDays(1).atStartOfDay(CASA).toOffsetDateTime();
        OffsetDateTime startOfMonth = currentMonth.atDay(1).atStartOfDay(CASA).toOffsetDateTime();
        OffsetDateTime startOfNextMonth = currentMonth.plusMonths(1).atDay(1).atStartOfDay(CASA).toOffsetDateTime();
        OffsetDateTime startOfPrevMonth = previousMonth.atDay(1).atStartOfDay(CASA).toOffsetDateTime();
        OffsetDateTime startOfYear = today.withDayOfYear(1).atStartOfDay(CASA).toOffsetDateTime();
        OffsetDateTime startOfNextYear = today.plusYears(1).withDayOfYear(1).atStartOfDay(CASA).toOffsetDateTime();

        BigDecimal caJour = sumPaidTotalBetween(startOfDay, startOfTomorrow);
        BigDecimal caMois = sumPaidTotalBetween(startOfMonth, startOfNextMonth);
        BigDecimal caYTD = sumPaidTotalBetween(startOfYear, startOfNextYear);
        BigDecimal caMoisN1 = sumPaidTotalBetween(startOfPrevMonth, startOfMonth);

        List<MonthAmount> ca12 = compute12MonthTimeline(currentMonth);
        List<ActeBreakdown> parActe = computeCaParActe(startOfMonth, startOfNextMonth);

        ImpayesAggregate impayes = loadImpayes();

        // Taux encaissement (mois courant) = CA encaissé / (CA encaissé + impayés émis du mois).
        // We approximate « total émis » comme CA encaissé du mois + impayés totaux (les
        // impayés ne sont pas filtrés par mois — leur âge médian est court côté MVP, et le
        // statut EMISE indique justement « pas encore encaissé »).
        BigDecimal totalEmis = caMois.add(impayes.total());
        BigDecimal taux = (totalEmis.signum() == 0)
                ? BigDecimal.ONE
                : caMois.divide(totalEmis, 4, RoundingMode.HALF_UP);

        return new FinancialDashboardView(
                caJour,
                caMois,
                caYTD,
                caMoisN1,
                ca12,
                parActe,
                impayes.total(),
                impayes.count(),
                taux);
    }

    // ── CA windows ────────────────────────────────────────────────────────────

    private BigDecimal sumPaidTotalBetween(OffsetDateTime fromInclusive, OffsetDateTime toExclusive) {
        BigDecimal v = jdbc.queryForObject("""
                SELECT COALESCE(SUM(total), 0)
                  FROM billing_invoice
                 WHERE status IN ('PAYEE_TOTALE','PAYEE_PARTIELLE')
                   AND issued_at >= ?
                   AND issued_at <  ?
                """,
                BigDecimal.class,
                toUtc(fromInclusive),
                toUtc(toExclusive));
        return v == null ? BigDecimal.ZERO : v.setScale(2, RoundingMode.HALF_UP);
    }

    // ── 12-month timeline ─────────────────────────────────────────────────────

    private List<MonthAmount> compute12MonthTimeline(YearMonth currentMonth) {
        // 12 months including current → window is [start12moAgo, startOfNextMonth)
        YearMonth startMonth = currentMonth.minusMonths(11);
        OffsetDateTime windowStart = startMonth.atDay(1).atStartOfDay(CASA).toOffsetDateTime();
        OffsetDateTime windowEnd = currentMonth.plusMonths(1).atDay(1).atStartOfDay(CASA).toOffsetDateTime();

        // date_trunc returns the local truncation when applied to TIMESTAMPTZ in UTC; we
        // need the Casa-local month, so cast issued_at to Africa/Casablanca first.
        Map<String, BigDecimal> byMonth = new HashMap<>();
        jdbc.query("""
                SELECT to_char(date_trunc('month', issued_at AT TIME ZONE 'Africa/Casablanca'), 'YYYY-MM') AS ym,
                       COALESCE(SUM(total), 0) AS amount
                  FROM billing_invoice
                 WHERE status IN ('PAYEE_TOTALE','PAYEE_PARTIELLE')
                   AND issued_at >= ?
                   AND issued_at <  ?
                 GROUP BY 1
                """,
                rs -> {
                    byMonth.put(rs.getString("ym"), rs.getBigDecimal("amount"));
                },
                toUtc(windowStart),
                toUtc(windowEnd));

        List<MonthAmount> series = new ArrayList<>(12);
        for (int i = 0; i < 12; i++) {
            YearMonth ym = startMonth.plusMonths(i);
            String key = String.format("%04d-%02d", ym.getYear(), ym.getMonthValue());
            BigDecimal amt = byMonth.getOrDefault(key, BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            series.add(new MonthAmount(key, amt));
        }
        return series;
    }

    // ── CA par acte (top 10 du mois courant) ──────────────────────────────────

    private List<ActeBreakdown> computeCaParActe(OffsetDateTime monthStart, OffsetDateTime monthEnd) {
        // SUM(line_total) GROUP BY act_id (NULL → "AUTRE"), filtré sur les invoices encaissées
        // du mois courant. LEFT JOIN catalog_act pour récupérer code/label.
        Map<String, ActeAccumulator> agg = new LinkedHashMap<>();
        jdbc.query("""
                SELECT COALESCE(a.code, 'AUTRE')                  AS code,
                       COALESCE(a.name, l.description, 'Autre')   AS label,
                       SUM(l.line_total)                          AS amount,
                       COUNT(*)                                   AS cnt
                  FROM billing_invoice i
                  JOIN billing_invoice_line l ON l.invoice_id = i.id
                  LEFT JOIN catalog_act a     ON a.id = l.act_id
                 WHERE i.status IN ('PAYEE_TOTALE','PAYEE_PARTIELLE')
                   AND i.issued_at >= ?
                   AND i.issued_at <  ?
                 GROUP BY COALESCE(a.code, 'AUTRE'),
                          COALESCE(a.name, l.description, 'Autre')
                 ORDER BY amount DESC
                 LIMIT ?
                """,
                rs -> {
                    String code = rs.getString("code");
                    BigDecimal amt = rs.getBigDecimal("amount").setScale(2, RoundingMode.HALF_UP);
                    long cnt = rs.getLong("cnt");
                    String label = rs.getString("label");
                    // GROUP key includes label (because line.description may differ across lines for
                    // same act_id when act is null) — collapse on code at app level.
                    agg.merge(code, new ActeAccumulator(label, amt, cnt), ActeAccumulator::merge);
                },
                toUtc(monthStart),
                toUtc(monthEnd),
                ACTE_TOP_N * 4); // pull a bit more then re-sort + cap

        return agg.entrySet().stream()
                .map(e -> new ActeBreakdown(
                        e.getKey(),
                        e.getValue().label(),
                        e.getValue().amount(),
                        e.getValue().count()))
                .sorted((a, b) -> b.amount().compareTo(a.amount()))
                .limit(ACTE_TOP_N)
                .toList();
    }

    private record ActeAccumulator(String label, BigDecimal amount, long count) {
        ActeAccumulator merge(ActeAccumulator other) {
            return new ActeAccumulator(label, amount.add(other.amount), count + other.count);
        }
    }

    // ── Impayés ───────────────────────────────────────────────────────────────

    private ImpayesAggregate loadImpayes() {
        return jdbc.queryForObject("""
                SELECT COALESCE(SUM(total - paid_total), 0) AS total,
                       COUNT(*)                              AS cnt
                  FROM billing_invoice
                 WHERE status = 'EMISE'
                """,
                (rs, n) -> new ImpayesAggregate(
                        rs.getBigDecimal("total").setScale(2, RoundingMode.HALF_UP),
                        rs.getLong("cnt")));
    }

    private record ImpayesAggregate(BigDecimal total, long count) {}

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static OffsetDateTime toUtc(OffsetDateTime odt) {
        return odt.withOffsetSameInstant(ZoneOffset.UTC);
    }
}
