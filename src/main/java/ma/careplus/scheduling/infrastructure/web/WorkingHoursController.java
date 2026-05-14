package ma.careplus.scheduling.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cabinet working hours configuration.
 *
 * <p>Read by the agenda (slot availability) and by the patient-facing booking
 * surface. Replaced wholesale by a single PUT — the onboarding wizard and the
 * settings page both submit the full week at once, which keeps the
 * "what's open" check on the read path branch-free.
 *
 * <p>Day-of-week follows ISO-8601 (1=Mon ... 7=Sun). Multiple time slots per
 * day are allowed (morning + afternoon) and modelled as separate rows; the
 * controller groups them by day in the view.
 */
@RestController
@Tag(name = "settings", description = "Cabinet working hours")
public class WorkingHoursController {

    private final JdbcTemplate jdbc;

    public WorkingHoursController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** One time slot inside a day (morning or afternoon). */
    public record SlotView(String startTime, String endTime) {}

    /** One day of the week, with its slots. {@code active=false} = day fermé (no slots). */
    public record DayView(int dayOfWeek, boolean active, List<SlotView> slots) {}

    /** Full-week response. Always 7 entries, dayOfWeek 1..7, in order. */
    public record WorkingHoursView(List<DayView> days) {}

    public record SlotRequest(
            @NotNull @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String startTime,
            @NotNull @Pattern(regexp = "^([01]\\d|2[0-3]):[0-5]\\d$") String endTime
    ) {}

    public record DayRequest(
            @Min(1) @Max(7) int dayOfWeek,
            boolean active,
            @NotNull List<@Valid SlotRequest> slots
    ) {}

    public record UpdateWorkingHoursRequest(
            @NotNull List<@Valid DayRequest> days
    ) {}

    @GetMapping("/api/settings/working-hours")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(summary = "Lire les horaires d'ouverture du cabinet")
    public WorkingHoursView list() {
        // Group rows by day. Skip ranges where active=false has no slots stored
        // (we emit an explicit { active:false, slots:[] } in that case).
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT day_of_week, start_time, end_time, active "
                        + "FROM scheduling_working_hours "
                        + "ORDER BY day_of_week, start_time");
        Map<Integer, List<SlotView>> byDay = new java.util.LinkedHashMap<>();
        Map<Integer, Boolean> activeByDay = new java.util.LinkedHashMap<>();
        for (Map<String, Object> r : rows) {
            int dow = ((Number) r.get("day_of_week")).intValue();
            LocalTime s = ((java.sql.Time) r.get("start_time")).toLocalTime();
            LocalTime e = ((java.sql.Time) r.get("end_time")).toLocalTime();
            boolean active = (Boolean) r.get("active");
            byDay.computeIfAbsent(dow, k -> new ArrayList<>()).add(new SlotView(s.toString(), e.toString()));
            activeByDay.merge(dow, active, (a, b) -> a || b);
        }
        List<DayView> days = new ArrayList<>(7);
        for (int dow = 1; dow <= 7; dow++) {
            List<SlotView> slots = byDay.getOrDefault(dow, List.of());
            boolean active = !slots.isEmpty() && activeByDay.getOrDefault(dow, false);
            days.add(new DayView(dow, active, slots));
        }
        return new WorkingHoursView(days);
    }

    @PutMapping("/api/settings/working-hours")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    @Operation(summary = "Remplacer la totalité des horaires (replace-all)")
    public WorkingHoursView replace(@Valid @RequestBody UpdateWorkingHoursRequest req) {
        // Validate each slot's start < end inside the same day; reject overlapping
        // slots inside a day. Cross-day validation is not needed (ISO days are disjoint).
        for (DayRequest d : req.days()) {
            List<SlotRequest> slots = d.slots();
            for (int i = 0; i < slots.size(); i++) {
                LocalTime s = LocalTime.parse(slots.get(i).startTime());
                LocalTime e = LocalTime.parse(slots.get(i).endTime());
                if (!s.isBefore(e)) {
                    throw new BusinessException(
                            "WH_SLOT_INVALID",
                            "Horaires invalides pour le jour " + d.dayOfWeek()
                                    + " : début (" + s + ") doit être avant fin (" + e + ").",
                            HttpStatus.BAD_REQUEST.value());
                }
                for (int j = i + 1; j < slots.size(); j++) {
                    LocalTime os = LocalTime.parse(slots.get(j).startTime());
                    LocalTime oe = LocalTime.parse(slots.get(j).endTime());
                    if (s.isBefore(oe) && os.isBefore(e)) {
                        throw new BusinessException(
                                "WH_SLOT_OVERLAP",
                                "Créneaux qui se chevauchent pour le jour " + d.dayOfWeek(),
                                HttpStatus.BAD_REQUEST.value());
                    }
                }
            }
        }
        jdbc.update("DELETE FROM scheduling_working_hours");
        for (DayRequest d : req.days()) {
            if (!d.active() || d.slots().isEmpty()) continue;
            for (SlotRequest s : d.slots()) {
                jdbc.update(
                        "INSERT INTO scheduling_working_hours "
                                + "(id, day_of_week, start_time, end_time, active) "
                                + "VALUES (?, ?, ?::time, ?::time, TRUE)",
                        UUID.randomUUID(), d.dayOfWeek(), s.startTime(), s.endTime());
            }
        }
        return list();
    }
}
