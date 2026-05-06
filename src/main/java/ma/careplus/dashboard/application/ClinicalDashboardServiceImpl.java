package ma.careplus.dashboard.application;

import java.sql.Date;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.WeekFields;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import ma.careplus.dashboard.infrastructure.web.dto.ClinicalDashboardView;
import ma.careplus.dashboard.infrastructure.web.dto.ClinicalDashboardView.ActivityPoint;
import ma.careplus.dashboard.infrastructure.web.dto.ClinicalDashboardView.TopPathology;
import ma.careplus.shared.config.ClockConfig;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cross-module read-only aggregator backing GET /api/dashboard/clinical.
 *
 * <p>Reads {@code patient_patient} and {@code clinical_consultation} via
 * {@link JdbcTemplate} (no JPA entity import) so we keep the dashboard module
 * decoupled from patient/clinical persistence layouts. This pattern matches
 * the BillingService precedent (cross-module read accepted in
 * {@code docs/ARCHITECTURE.md}).
 *
 * <p>Performance: every KPI is a dedicated SQL with WHERE / GROUP BY pushed to
 * Postgres. No load-and-filter loops — acceptable at MVP scale (≤ 5 k patients,
 * ≤ ~100 k consultations per cabinet) and headroom for x10.
 *
 * <h3>ICD-10 parsing rationale</h3>
 * The {@code clinical_consultation.diagnosis} column is free text (no catalog
 * table for ICD-10 in MVP — see {@code docs/BACKLOG.md}). We extract codes
 * matching the regex {@code [A-Z]\\d{2}(\\.\\d+)?} via a permissive pass on
 * each non-null diagnosis. {@code label} falls back to the code itself, the
 * frontend can later resolve to a human-readable libellé via a future catalog.
 */
@Service
@Transactional(readOnly = true)
public class ClinicalDashboardServiceImpl implements ClinicalDashboardService {

    /** Permissive ICD-10 shape: one upper letter, two digits, optional .digits. */
    private static final Pattern ICD10 = Pattern.compile("\\b([A-Z]\\d{2}(?:\\.\\d{1,2})?)\\b");

    private final JdbcTemplate jdbc;

    public ClinicalDashboardServiceImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public ClinicalDashboardView getClinicalDashboard(UUID practitionerId) {
        LocalDate today = LocalDate.now(ClockConfig.ZONE);
        ZonedDateTime startOfToday = today.atStartOfDay(ClockConfig.ZONE);
        ZonedDateTime startOfTomorrow = startOfToday.plusDays(1);

        // ISO week (Monday → Monday)
        LocalDate startOfWeekDate = today.with(WeekFields.of(Locale.FRANCE).dayOfWeek(), 1);
        ZonedDateTime startOfWeek = startOfWeekDate.atStartOfDay(ClockConfig.ZONE);
        ZonedDateTime startOfNextWeek = startOfWeek.plusWeeks(1);

        // Calendar month
        ZonedDateTime startOfMonth = today.withDayOfMonth(1).atStartOfDay(ClockConfig.ZONE);
        ZonedDateTime startOfNextMonth = startOfMonth.plusMonths(1);

        // ── 1. patientsActifsTotal ────────────────────────────────────────────
        long patientsActifsTotal = firstLong(
                "SELECT COUNT(*) FROM patient_patient WHERE deleted_at IS NULL");

        // ── 2. patientsActifs30j ─────────────────────────────────────────────
        // distinct patients with ≥ 1 SIGNEE consultation in the last 30 days,
        // restricted to non-soft-deleted patients.
        OffsetDateTime windowStart30 = startOfToday.minusDays(30).toOffsetDateTime();
        long patientsActifs30j = firstLong("""
                SELECT COUNT(DISTINCT c.patient_id)
                FROM clinical_consultation c
                JOIN patient_patient p ON p.id = c.patient_id
                WHERE c.status = 'SIGNEE'
                  AND c.signed_at IS NOT NULL
                  AND c.signed_at >= ?
                  AND p.deleted_at IS NULL
                """, java.sql.Timestamp.from(windowStart30.toInstant()));

        // ── 3. consultationsAujourdhui / Semaine / Mois (this practitioner) ──
        long today_ = countSigned(practitionerId, startOfToday, startOfTomorrow);
        long thisWeek_ = countSigned(practitionerId, startOfWeek, startOfNextWeek);
        long thisMonth_ = countSigned(practitionerId, startOfMonth, startOfNextMonth);

        // ── 4. ageMoyenPatientele ────────────────────────────────────────────
        Double ageMoyen = jdbc.query("""
                SELECT AVG(EXTRACT(YEAR FROM age(birth_date))::numeric)::double precision
                FROM patient_patient
                WHERE deleted_at IS NULL AND birth_date IS NOT NULL
                """, rs -> rs.next() ? (Double) rs.getObject(1) : null);

        // ── 5. topPathologies — parse free-text diagnoses ────────────────────
        List<TopPathology> top = topPathologies();

        // ── 6. activite7j / activite30j (cabinet-wide signed consultations) ──
        List<ActivityPoint> activite7j = dailyActivity(today, 7);
        List<ActivityPoint> activite30j = dailyActivity(today, 30);

        return new ClinicalDashboardView(
                patientsActifsTotal,
                patientsActifs30j,
                today_,
                thisWeek_,
                thisMonth_,
                ageMoyen,
                top,
                activite7j,
                activite30j);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // helpers
    // ─────────────────────────────────────────────────────────────────────────

    private long firstLong(String sql, Object... args) {
        Long v = jdbc.queryForObject(sql, Long.class, args);
        return v == null ? 0L : v;
    }

    private long countSigned(UUID practitionerId, ZonedDateTime fromInclusive, ZonedDateTime toExclusive) {
        return firstLong("""
                SELECT COUNT(*) FROM clinical_consultation
                WHERE practitioner_id = ?
                  AND status = 'SIGNEE'
                  AND signed_at IS NOT NULL
                  AND signed_at >= ?
                  AND signed_at <  ?
                """,
                practitionerId,
                java.sql.Timestamp.from(fromInclusive.toInstant()),
                java.sql.Timestamp.from(toExclusive.toInstant()));
    }

    /**
     * Pull all non-blank diagnoses for signed consultations, parse ICD-10-shaped
     * codes, count occurrences, return top 5 desc. Acceptable to scan all
     * SIGNEE rows at MVP scale; future post-MVP optimisation: persist a
     * structured {@code clinical_consultation_diagnosis_code} side table.
     */
    private List<TopPathology> topPathologies() {
        List<String> diagnoses = jdbc.queryForList("""
                SELECT diagnosis FROM clinical_consultation
                WHERE status = 'SIGNEE'
                  AND diagnosis IS NOT NULL
                  AND length(trim(diagnosis)) > 0
                """, String.class);

        Map<String, Long> counts = new HashMap<>();
        for (String diagnosis : diagnoses) {
            if (diagnosis == null) continue;
            Matcher m = ICD10.matcher(diagnosis);
            // De-duplicate codes within a single diagnosis text — count one per
            // consultation, not one per occurrence in the same row.
            java.util.Set<String> codesInRow = new java.util.HashSet<>();
            while (m.find()) {
                codesInRow.add(m.group(1));
            }
            for (String code : codesInRow) {
                counts.merge(code, 1L, Long::sum);
            }
        }

        return counts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(5)
                .map(e -> new TopPathology(e.getKey(), e.getKey(), e.getValue()))
                .toList();
    }

    /**
     * Build a {@code days}-entry array of {date, count} ending today, oldest
     * first, filling missing days with 0.
     */
    private List<ActivityPoint> dailyActivity(LocalDate today, int days) {
        LocalDate firstDay = today.minusDays(days - 1L);
        ZonedDateTime fromInclusive = firstDay.atStartOfDay(ClockConfig.ZONE);
        ZonedDateTime toExclusive = today.plusDays(1).atStartOfDay(ClockConfig.ZONE);

        // Group rows in cabinet-local TZ, not UTC — otherwise the day boundary
        // shifts by ±1h and rows near midnight land in the wrong bucket.
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT (date_trunc('day', signed_at AT TIME ZONE 'Africa/Casablanca'))::date AS d,
                       COUNT(*) AS n
                FROM clinical_consultation
                WHERE status = 'SIGNEE'
                  AND signed_at IS NOT NULL
                  AND signed_at >= ?
                  AND signed_at <  ?
                GROUP BY 1
                """,
                java.sql.Timestamp.from(fromInclusive.toInstant()),
                java.sql.Timestamp.from(toExclusive.toInstant()));

        Map<LocalDate, Long> byDate = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object dRaw = row.get("d");
            LocalDate d = (dRaw instanceof Date sd) ? sd.toLocalDate() : LocalDate.parse(String.valueOf(dRaw));
            Number n = (Number) row.get("n");
            byDate.put(d, n == null ? 0L : n.longValue());
        }

        List<ActivityPoint> out = new ArrayList<>(days);
        for (long i = 0; i < days; i++) {
            LocalDate d = firstDay.plus(i, ChronoUnit.DAYS);
            out.add(new ActivityPoint(d, byDate.getOrDefault(d, 0L)));
        }
        return out;
    }
}
