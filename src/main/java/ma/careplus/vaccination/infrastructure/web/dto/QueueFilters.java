package ma.careplus.vaccination.infrastructure.web.dto;

import java.util.UUID;
import ma.careplus.vaccination.domain.VaccinationCalendarStatus;

/**
 * Filters for the vaccination worklist queue.
 * All fields are nullable; service applies defaults where needed.
 */
public record QueueFilters(
        /** If null → defaults to OVERDUE + DUE_SOON. */
        VaccinationCalendarStatus status,

        /** Filter by vaccine code (e.g. "BCG"). Null = all vaccines. */
        String vaccineCode,

        /**
         * Filter by practitioner id — MVP TODO: join on appointment.practitioner_id
         * is non-trivial at this level (no cross-module repo allowed, would need
         * a dedicated JDBC query joining scheduling_appointment). Accepted deviation:
         * this filter is accepted in the request but not applied in MVP; the service
         * returns a TODO comment and logs it. Documented in DECISIONS.md.
         */
        UUID practitionerId,

        /** Minimum patient age in months (inclusive). Null = no lower bound. */
        Integer ageGroupMinMonths,

        /** Maximum patient age in months (inclusive). Null = no upper bound. */
        Integer ageGroupMaxMonths,

        /** Number of upcoming days horizon for UPCOMING filter. Default 30. */
        Integer upcomingHorizonDays,

        /** 0-based page index. Default 0. */
        Integer page,

        /** Page size. Default 50, max 200. */
        Integer size
) {
    /** Resolved upcomingHorizonDays with default. */
    public int resolvedHorizonDays() {
        return upcomingHorizonDays != null ? upcomingHorizonDays : 30;
    }

    /** Resolved page with default. */
    public int resolvedPage() {
        return page != null ? Math.max(0, page) : 0;
    }

    /** Resolved size with default and cap. */
    public int resolvedSize() {
        if (size == null) return 50;
        return Math.min(Math.max(1, size), 200);
    }
}
