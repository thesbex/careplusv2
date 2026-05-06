package ma.careplus.dashboard.application;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import ma.careplus.dashboard.infrastructure.web.dto.AgendaDashboardView;
import ma.careplus.dashboard.infrastructure.web.dto.AgendaDashboardView.HourlyLoad;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-side aggregate for the agenda dashboard.
 *
 * <p>Uses {@link JdbcTemplate} for all queries — no JPA entity is needed for
 * these counters and we want narrow GROUP-BY queries that touch
 * {@code scheduling_appointment}, {@code patient_patient} and
 * {@code scheduling_working_hours} only.
 *
 * <p>Cabinet timezone is fixed to {@code Africa/Casablanca}; all "today" /
 * "this week" / "this month" windows are computed in that zone, then
 * converted to UTC for the SQL filters (the timestamps are stored as
 * {@code TIMESTAMPTZ}).
 *
 * <p><b>Taux de remplissage</b>: occupied = appointments NOT IN
 * (ANNULE, NO_SHOW). Capacity comes from {@code scheduling_working_hours}
 * in 30-minute slot granularity. If the table is empty (cabinet not yet
 * configured) we fall back to 8h–18h × 30min = 20 slots/working day, as
 * specified in the F1 contract.
 */
@Service
@Transactional(readOnly = true)
public class AgendaDashboardServiceImpl implements AgendaDashboardService {

    /** Cabinet timezone — single-tenant on-prem deployment, hardcoded. */
    static final ZoneId CABINET = ZoneId.of("Africa/Casablanca");

    /** Slot granularity for capacity computation. */
    private static final int SLOT_MINUTES = 30;

    /** Fallback when scheduling_working_hours is empty: 8h-18h × 30min = 20 slots/day. */
    private static final int FALLBACK_SLOTS_PER_DAY = 20;

    /** Charge-horaire histogram covers 08:00 → 19:00 inclusive (12 buckets). */
    private static final int CHARGE_FIRST_HOUR = 8;
    private static final int CHARGE_LAST_HOUR  = 19;

    private final JdbcTemplate jdbc;

    public AgendaDashboardServiceImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public AgendaDashboardView getAgendaDashboard() {
        LocalDate today = LocalDate.now(CABINET);

        // Today window
        OffsetDateTime todayStart = today.atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);
        OffsetDateTime tomorrowStart = today.plusDays(1).atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);

        // ISO week (Mon -> next Mon). Working days = Mon..Fri (5).
        LocalDate weekStart = today.with(DayOfWeek.MONDAY);
        LocalDate weekEnd   = weekStart.plusDays(7);
        OffsetDateTime weekStartUtc = weekStart.atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);
        OffsetDateTime weekEndUtc   = weekEnd.atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);

        // Month window
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate monthEnd   = monthStart.plusMonths(1);
        OffsetDateTime monthStartUtc = monthStart.atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);
        OffsetDateTime monthEndUtc   = monthEnd.atStartOfDay(CABINET).toOffsetDateTime()
                .withOffsetSameInstant(ZoneOffset.UTC);

        long rdvAujourdhui = countActiveAppointments(todayStart, tomorrowStart);
        long rdvSemaine    = countActiveAppointments(weekStartUtc, weekEndUtc);

        long noShowsSemaine     = countByStatus("NO_SHOW", weekStartUtc, weekEndUtc);
        long annulationsSemaine = countByStatus("ANNULE",  weekStartUtc, weekEndUtc);

        // taux remplissage = active appointments / open slots, on the same window.
        int slotsToday = capacitySlotsForDay(today);
        long capacityToday = slotsToday;
        double tauxJour = capacityToday == 0 ? 0.0 : (double) rdvAujourdhui / (double) capacityToday;

        // Working week = Mon..Fri (5 days). Sum capacity for those days, count active appts on
        // the same restricted window.
        long capacityWeek = 0;
        long rdvWorkingWeek = 0;
        for (int i = 0; i < 5; i++) {
            LocalDate d = weekStart.plusDays(i);
            capacityWeek += capacitySlotsForDay(d);
            OffsetDateTime ds = d.atStartOfDay(CABINET).toOffsetDateTime()
                    .withOffsetSameInstant(ZoneOffset.UTC);
            OffsetDateTime de = d.plusDays(1).atStartOfDay(CABINET).toOffsetDateTime()
                    .withOffsetSameInstant(ZoneOffset.UTC);
            rdvWorkingWeek += countActiveAppointments(ds, de);
        }
        double tauxSemaine = capacityWeek == 0 ? 0.0 : (double) rdvWorkingWeek / (double) capacityWeek;

        long nouveauxPatientsMois = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_patient "
                        + "WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?",
                Long.class, monthStartUtc, monthEndUtc);

        List<HourlyLoad> chargeHoraire = computeChargeHoraire(today, todayStart, tomorrowStart);

        return new AgendaDashboardView(
                rdvAujourdhui,
                rdvSemaine,
                round2(tauxJour),
                round2(tauxSemaine),
                noShowsSemaine,
                annulationsSemaine,
                nouveauxPatientsMois,
                chargeHoraire);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** COUNT(*) excluding ANNULE / NO_SHOW. Window matched on start_at. */
    private long countActiveAppointments(OffsetDateTime fromUtc, OffsetDateTime toUtc) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                        + "WHERE start_at >= ? AND start_at < ? "
                        + "AND status NOT IN ('ANNULE','NO_SHOW')",
                Long.class, fromUtc, toUtc);
        return n == null ? 0L : n;
    }

    /** COUNT(*) for a specific status, window matched on start_at. */
    private long countByStatus(String status, OffsetDateTime fromUtc, OffsetDateTime toUtc) {
        Long n = jdbc.queryForObject(
                "SELECT COUNT(*) FROM scheduling_appointment "
                        + "WHERE start_at >= ? AND start_at < ? AND status = ?",
                Long.class, fromUtc, toUtc, status);
        return n == null ? 0L : n;
    }

    /**
     * Number of 30-min slots opened by the cabinet on the given calendar day,
     * based on {@code scheduling_working_hours.day_of_week} (ISO 1=Mon..7=Sun).
     * Fallback: 20 slots/day for Mon-Fri / 0 for Sat-Sun if the table is empty.
     */
    private int capacitySlotsForDay(LocalDate day) {
        int dow = day.getDayOfWeek().getValue();
        List<LocalTime[]> ranges = jdbc.query(
                "SELECT start_time, end_time FROM scheduling_working_hours "
                        + "WHERE day_of_week = ? AND active = TRUE",
                (rs, i) -> new LocalTime[]{
                        rs.getTime("start_time").toLocalTime(),
                        rs.getTime("end_time").toLocalTime()
                },
                dow);

        if (ranges.isEmpty()) {
            // Fallback only if table truly has no rows AT ALL (cabinet not configured).
            // If it has rows for OTHER days but not this one, we must respect that — so
            // probe for the table-wide count.
            Integer total = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM scheduling_working_hours WHERE active = TRUE",
                    Integer.class);
            if (total == null || total == 0) {
                // Documented fallback per F1 spec: 8h-18h × 30min = 20 slots, Mon-Fri only.
                return (dow >= 1 && dow <= 5) ? FALLBACK_SLOTS_PER_DAY : 0;
            }
            return 0;
        }
        int slots = 0;
        for (LocalTime[] r : ranges) {
            int minutes = (r[1].toSecondOfDay() - r[0].toSecondOfDay()) / 60;
            if (minutes > 0) slots += minutes / SLOT_MINUTES;
        }
        return slots;
    }

    /**
     * Histogram from 08:00 to 19:00 inclusive (12 buckets). Each bucket is the
     * number of non-cancelled appointments whose {@code start_at} falls in
     * [HH:00, HH:00 + 1h) in the cabinet timezone.
     */
    private List<HourlyLoad> computeChargeHoraire(
            LocalDate today, OffsetDateTime todayStart, OffsetDateTime tomorrowStart) {
        // Fetch hours grouped on the SQL side using AT TIME ZONE 'Africa/Casablanca'.
        Map<Integer, Long> byHour = new HashMap<>();
        jdbc.query(
                "SELECT EXTRACT(HOUR FROM (start_at AT TIME ZONE 'Africa/Casablanca'))::int AS h, "
                        + "       COUNT(*) AS c "
                        + "FROM scheduling_appointment "
                        + "WHERE start_at >= ? AND start_at < ? "
                        + "  AND status NOT IN ('ANNULE','NO_SHOW') "
                        + "GROUP BY 1",
                rs -> {
                    int h = rs.getInt("h");
                    long c = rs.getLong("c");
                    byHour.put(h, c);
                },
                todayStart, tomorrowStart);

        List<HourlyLoad> out = new ArrayList<>(CHARGE_LAST_HOUR - CHARGE_FIRST_HOUR + 1);
        for (int h = CHARGE_FIRST_HOUR; h <= CHARGE_LAST_HOUR; h++) {
            String label = String.format("%02d:00", h);
            out.add(new HourlyLoad(label, byHour.getOrDefault(h, 0L)));
        }
        return out;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
