package ma.careplus.patient.infrastructure.web.dto;

import java.util.List;

/**
 * Page payload for the patients list (05a). Bundles the slice with the four
 * segment counts so the screen renders chips + table in a single round-trip.
 *
 * Mirrors Spring's Page envelope (content/totalElements/totalPages/number/size)
 * — but Page<T> can't carry the counts field without a custom serializer, so
 * we flatten it here.
 */
public record PatientListPageView(
        List<PatientListItemView> content,
        long totalElements,
        int totalPages,
        int number,
        int size,
        PatientListSegmentCounts counts
) {}
