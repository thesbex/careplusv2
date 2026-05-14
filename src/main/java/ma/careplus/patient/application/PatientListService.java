package ma.careplus.patient.application;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.patient.infrastructure.web.dto.PatientListItemView;
import ma.careplus.patient.infrastructure.web.dto.PatientListPageView;
import ma.careplus.patient.infrastructure.web.dto.PatientListSegmentCounts;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Read-only orchestrator behind the 05a patients list. Composes the patient
 * row with cross-module aggregates (last consultation, next appointment,
 * chronic antecedents, allergies, active pregnancy) in two SQL passes:
 *   1. paged native query (filters / search / segment)
 *   2. one batch aggregate query for the page's ids
 *
 * Tags are capped at 3 (most-recent chronic antecedents first, then
 * "Grossesse · S<weeks>" if applicable) so the table column stays compact.
 */
@Service
@Transactional(readOnly = true)
public class PatientListService {

    private static final Set<String> VALID_SEGMENTS = Set.of("tous", "recent", "chroniques", "nouveaux");
    private static final int MAX_TAGS = 3;
    private static final int NEW_PATIENT_WINDOW_DAYS = 30;

    private final PatientRepository patientRepository;

    public PatientListService(PatientRepository patientRepository) {
        this.patientRepository = patientRepository;
    }

    public PatientListPageView list(
            String q,
            String segment,
            String gender,
            Integer ageMin,
            Integer ageMax,
            Pageable pageable) {

        String normalizedSegment = normalizeSegment(segment);
        String normalizedQ = (q == null || q.isBlank()) ? null : q.trim();
        String normalizedGender = (gender == null || gender.isBlank()) ? null : gender.trim().toUpperCase(Locale.ROOT);

        Page<Patient> page = patientRepository.listForScreen(
                normalizedQ, normalizedSegment, normalizedGender, ageMin, ageMax, pageable);

        List<UUID> ids = page.getContent().stream().map(Patient::getId).toList();
        Map<UUID, Aggregates> aggMap = ids.isEmpty()
                ? Map.of()
                : loadAggregates(ids);

        OffsetDateTime newThreshold = OffsetDateTime.now().minusDays(NEW_PATIENT_WINDOW_DAYS);
        List<PatientListItemView> rows = page.getContent().stream()
                .map(p -> toRow(p, aggMap.get(p.getId()), newThreshold))
                .toList();

        return new PatientListPageView(
                rows,
                page.getTotalElements(),
                page.getTotalPages(),
                page.getNumber(),
                page.getSize(),
                counts());
    }

    public PatientListSegmentCounts counts() {
        return new PatientListSegmentCounts(
                patientRepository.countSegment("tous"),
                patientRepository.countSegment("recent"),
                patientRepository.countSegment("chroniques"),
                patientRepository.countSegment("nouveaux"));
    }

    private String normalizeSegment(String segment) {
        if (segment == null) return "tous";
        String trimmed = segment.trim().toLowerCase(Locale.ROOT);
        return VALID_SEGMENTS.contains(trimmed) ? trimmed : "tous";
    }

    private Map<UUID, Aggregates> loadAggregates(List<UUID> ids) {
        List<Object[]> rows = patientRepository.findListAggregates(ids);
        Map<UUID, Aggregates> result = new HashMap<>(rows.size() * 2);
        for (Object[] r : rows) {
            UUID patientId = (UUID) r[0];
            OffsetDateTime lastVisit = toOffsetDateTime(r[1]);
            OffsetDateTime nextAppt  = toOffsetDateTime(r[2]);
            long chronicCount        = ((Number) r[3]).longValue();
            String chronicTags       = (String) r[4];
            long allergyCount        = ((Number) r[5]).longValue();
            boolean pregnant         = Boolean.TRUE.equals(r[6]);
            result.put(patientId, new Aggregates(
                    lastVisit, nextAppt, chronicCount, splitTags(chronicTags),
                    allergyCount, pregnant));
        }
        return result;
    }

    private PatientListItemView toRow(Patient p, Aggregates a, OffsetDateTime newThreshold) {
        Aggregates safe = a != null ? a : Aggregates.EMPTY;
        boolean isNew = p.getCreatedAt() != null && p.getCreatedAt().isAfter(newThreshold);
        List<String> tags = buildTags(safe, p, isNew);

        return new PatientListItemView(
                p.getId(),
                p.getFirstName(),
                p.getLastName(),
                p.getGender(),
                p.getBirthDate(),
                p.getCin(),
                p.getPhone(),
                p.getCity(),
                p.getStatus().name(),
                p.getTier(),
                p.getPhotoDocumentId(),
                p.getCreatedAt(),
                safe.lastVisitAt(),
                safe.nextAppointmentAt(),
                safe.chronicCount() > 0,
                safe.allergyCount() > 0,
                safe.pregnant(),
                isNew,
                tags);
    }

    /**
     * Tags shown next to the antecedents column. Order:
     *   1. up to MAX_TAGS chronic antecedents (latest first)
     *   2. "Grossesse · S<weeks>" if pregnant — only if room remains
     * The "Nouveau" pill rendered in the row component comes from isNew, not
     * the tag list.
     */
    private List<String> buildTags(Aggregates a, Patient p, boolean isNew) {
        List<String> tags = new ArrayList<>(MAX_TAGS);
        for (String tag : a.chronicTags()) {
            if (tags.size() >= MAX_TAGS) break;
            tags.add(tag);
        }
        if (a.pregnant() && tags.size() < MAX_TAGS) {
            // Weeks since LMP would be more correct, but we only have the
            // pregnant flag here. The row component already shows a "Grossesse"
            // pill from the flag — so we stay compact.
            tags.add("Grossesse");
        }
        return Collections.unmodifiableList(tags);
    }

    private List<String> splitTags(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split("\\|\\|"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private OffsetDateTime toOffsetDateTime(Object v) {
        if (v == null) return null;
        if (v instanceof OffsetDateTime odt) return odt;
        if (v instanceof java.sql.Timestamp ts) return ts.toInstant().atOffset(java.time.ZoneOffset.UTC);
        if (v instanceof java.time.Instant inst) return inst.atOffset(java.time.ZoneOffset.UTC);
        // Defensive: postgres may hand us a LocalDateTime via JDBC depending on driver / dialect.
        if (v instanceof java.time.LocalDateTime ldt) return ldt.atOffset(java.time.ZoneOffset.UTC);
        return null;
    }

    /** Years between today and birth date (used by callers that filter on age client-side). */
    static int ageYears(LocalDate birth) {
        if (birth == null) return 0;
        return (int) ChronoUnit.YEARS.between(birth, LocalDate.now());
    }

    private record Aggregates(
            OffsetDateTime lastVisitAt,
            OffsetDateTime nextAppointmentAt,
            long chronicCount,
            List<String> chronicTags,
            long allergyCount,
            boolean pregnant
    ) {
        static final Aggregates EMPTY = new Aggregates(null, null, 0L, List.of(), 0L, false);
    }
}
