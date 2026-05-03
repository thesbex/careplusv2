package ma.careplus.vaccination.application;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.vaccination.domain.VaccinationCalendarStatus;
import ma.careplus.vaccination.domain.VaccinationDose;
import ma.careplus.vaccination.domain.VaccinationStatus;
import ma.careplus.vaccination.domain.VaccineCatalog;
import ma.careplus.vaccination.domain.VaccineScheduleDose;
import ma.careplus.vaccination.infrastructure.persistence.VaccinationDoseRepository;
import ma.careplus.vaccination.infrastructure.persistence.VaccineCatalogRepository;
import ma.careplus.vaccination.infrastructure.persistence.VaccineScheduleDoseRepository;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import ma.careplus.vaccination.infrastructure.web.dto.QueueFilters;
import ma.careplus.vaccination.infrastructure.web.dto.VaccinationQueueEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Worklist computation (Étape 3).
 *
 * <p>Design choice — reuse repositories directly rather than calling
 * {@link VaccinationServiceImpl#materializeCalendar} per patient. Rationale:
 * calling the public service method would require loading the patient twice
 * (once for findActiveById inside materializeCalendar, once for patient metadata
 * here) and would re-fetch all schedule + catalog rows N times for N patients.
 * Instead, we pre-load the schedule and catalog once, then compute calendar
 * entries in bulk for all pediatric patients. This avoids O(N) full Hibernate
 * session allocations and is much cheaper at 50–500 patients.
 *
 * <p>Cross-module read on PatientRepository: accepted exception, same precedent
 * as VaccinationServiceImpl, BillingService, CatalogService.
 *
 * <p>TODO (post-MVP): practitionerId filter requires joining scheduling_appointment
 * to find the most-frequent practitioner per patient. That join crosses module
 * boundaries (scheduling repo). Deferred: accepted in request params but not
 * applied. Logged here and in docs/DECISIONS.md.
 */
@Service
@Transactional(readOnly = true)
public class VaccinationQueueServiceImpl implements VaccinationQueueService {

    private static final Logger log = LoggerFactory.getLogger(VaccinationQueueServiceImpl.class);

    /** Same adult cutoff as VaccinationServiceImpl — entries beyond 5y past tolerance are dropped. */
    private static final int ADULT_CUTOFF_DAYS = 5 * 365;

    /** Pediatric cutoff: only patients born within the last 18 years. */
    private static final int MAX_AGE_YEARS = 18;

    private final PatientRepository patientRepo;
    private final VaccinationDoseRepository doseRepo;
    private final VaccineCatalogRepository catalogRepo;
    private final VaccineScheduleDoseRepository scheduleRepo;

    public VaccinationQueueServiceImpl(
            PatientRepository patientRepo,
            VaccinationDoseRepository doseRepo,
            VaccineCatalogRepository catalogRepo,
            VaccineScheduleDoseRepository scheduleRepo) {
        this.patientRepo = patientRepo;
        this.doseRepo = doseRepo;
        this.catalogRepo = catalogRepo;
        this.scheduleRepo = scheduleRepo;
    }

    @Override
    public PageView<VaccinationQueueEntry> queue(QueueFilters filters) {
        LocalDate today = LocalDate.now();
        LocalDate minBirthDate = today.minusYears(MAX_AGE_YEARS);

        // 1. Load all pediatric, non-deleted patients (DTO projection via Patient entity).
        //    We load them all at once and filter in-memory — acceptable at MVP scale
        //    (a single cabinet will have at most a few thousand patients; pediatric subset
        //    is even smaller). Post-MVP: add a DB-side age filter query.
        List<Patient> allPediatric = patientRepo.findAllActive(PageRequest.of(0, Integer.MAX_VALUE))
                .getContent()
                .stream()
                .filter(p -> p.getBirthDate() != null && p.getBirthDate().isAfter(minBirthDate))
                .toList();

        // 2. Pre-load schedule + catalog once for all patients
        List<VaccineScheduleDose> schedule = scheduleRepo.findAllByOrderByTargetAgeDaysAsc();
        Map<UUID, VaccineCatalog> catalogById = catalogRepo.findAll().stream()
                .filter(VaccineCatalog::isActive)
                .collect(Collectors.toMap(VaccineCatalog::getId, Function.identity()));

        // 3. For each pediatric patient, compute matching queue entries
        List<VaccinationQueueEntry> allEntries = new ArrayList<>();

        for (Patient patient : allPediatric) {
            // Apply age group filter early to skip calendar computation
            int ageMonths = (int) ChronoUnit.MONTHS.between(patient.getBirthDate(), today);
            if (filters.ageGroupMinMonths() != null && ageMonths < filters.ageGroupMinMonths()) continue;
            if (filters.ageGroupMaxMonths() != null && ageMonths > filters.ageGroupMaxMonths()) continue;

            // Load persisted doses for this patient
            List<VaccinationDose> persisted = doseRepo.findByPatientIdAndDeletedAtIsNull(patient.getId());

            // Index by (vaccineId, doseNumber) — schedule-linked doses only
            Map<String, VaccinationDose> persistedByKey = persisted.stream()
                    .filter(d -> d.getScheduleDoseId() != null)
                    .collect(Collectors.toMap(
                            d -> doseKey(d.getVaccineId(), d.getDoseNumber()),
                            Function.identity(),
                            (a, b) -> a));

            // Build set of ADMINISTERED (vaccineId, doseNumber) keys — to exclude from queue.
            // Include both schedule-linked and off-schedule doses: if the patient received
            // BCG D1 off-schedule (scheduleDoseId null), it still counts as administered.
            java.util.Set<String> administeredKeys = persisted.stream()
                    .filter(d -> d.getStatus() == VaccinationStatus.ADMINISTERED)
                    .map(d -> doseKey(d.getVaccineId(), d.getDoseNumber()))
                    .collect(Collectors.toSet());

            for (VaccineScheduleDose sched : schedule) {
                VaccineCatalog catalog = catalogById.get(sched.getVaccineId());
                if (catalog == null) continue;

                // Apply vaccineCode filter
                if (filters.vaccineCode() != null
                        && !catalog.getCode().equalsIgnoreCase(filters.vaccineCode())) continue;

                LocalDate targetDate = patient.getBirthDate().plusDays(sched.getTargetAgeDays());
                int toleranceDays = sched.getToleranceDays();

                String key = doseKey(sched.getVaccineId(), sched.getDoseNumber());

                // Skip if dose already administered
                if (administeredKeys.contains(key)) continue;

                // Check if there's a persisted row (DEFERRED/SKIPPED) — still appears in queue
                // with its computed status
                VaccinationDose persistedDose = persistedByKey.get(key);

                // Compute status
                VaccinationCalendarStatus computedStatus;
                if (persistedDose != null
                        && persistedDose.getStatus() != VaccinationStatus.PLANNED) {
                    // DEFERRED or SKIPPED — compute the time-based status for sorting
                    computedStatus = computeStatus(today, targetDate, toleranceDays);
                } else {
                    // Adult edge-case cutoff
                    LocalDate cutoff = targetDate.plusDays(toleranceDays).plusDays(ADULT_CUTOFF_DAYS);
                    if (today.isAfter(cutoff)) continue;
                    computedStatus = computeStatus(today, targetDate, toleranceDays);
                }

                // Apply status filter
                if (!matchesStatusFilter(filters, computedStatus, targetDate, today)) continue;

                int daysOverdue = (int) ChronoUnit.DAYS.between(targetDate, today);

                allEntries.add(new VaccinationQueueEntry(
                        patient.getId(),
                        patient.getFirstName(),
                        patient.getLastName(),
                        patient.getPhotoDocumentId(),
                        patient.getBirthDate(),
                        ageMonths,
                        catalog.getId(),
                        catalog.getCode(),
                        catalog.getNameFr(),
                        sched.getDoseNumber(),
                        sched.getLabelFr(),
                        sched.getId(),
                        targetDate,
                        daysOverdue,
                        computedStatus
                ));
            }
        }

        // TODO (post-MVP): apply practitionerId filter via scheduling_appointment join.
        // Requires cross-module JDBC query on scheduling_appointment — deferred.
        if (filters.practitionerId() != null) {
            log.debug("practitionerId filter requested ({}) but not applied in MVP — TODO post-MVP",
                    filters.practitionerId());
        }

        // 4. Sort: OVERDUE (most days overdue first) → DUE_SOON (nearest targetDate) → UPCOMING
        allEntries.sort(urgencyComparator());

        // 5. Paginate
        int page = filters.resolvedPage();
        int size = filters.resolvedSize();
        long total = allEntries.size();

        int fromIndex = page * size;
        int toIndex = (int) Math.min(fromIndex + size, total);

        List<VaccinationQueueEntry> pageContent = fromIndex >= total
                ? List.of()
                : allEntries.subList(fromIndex, toIndex);

        return PageView.of(pageContent, total, page, size);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    private static String doseKey(UUID vaccineId, short doseNumber) {
        return vaccineId.toString() + ":" + doseNumber;
    }

    private static VaccinationCalendarStatus computeStatus(
            LocalDate today, LocalDate targetDate, int toleranceDays) {
        LocalDate dueSoonStart = targetDate.minusDays(toleranceDays);
        LocalDate dueSoonEnd = targetDate.plusDays(toleranceDays);

        if (!today.isAfter(dueSoonStart.minusDays(1))) {
            return VaccinationCalendarStatus.UPCOMING;
        } else if (!today.isAfter(dueSoonEnd)) {
            return VaccinationCalendarStatus.DUE_SOON;
        } else {
            return VaccinationCalendarStatus.OVERDUE;
        }
    }

    /**
     * Returns true if the given computed status matches the filter.
     * If filter.status() is null → accept OVERDUE + DUE_SOON (default worklist).
     */
    private boolean matchesStatusFilter(QueueFilters filters,
                                         VaccinationCalendarStatus computedStatus,
                                         LocalDate targetDate, LocalDate today) {
        if (filters.status() == null) {
            // Default: OVERDUE + DUE_SOON
            return computedStatus == VaccinationCalendarStatus.OVERDUE
                    || computedStatus == VaccinationCalendarStatus.DUE_SOON;
        }
        if (filters.status() == computedStatus) {
            if (computedStatus == VaccinationCalendarStatus.UPCOMING) {
                // Apply horizon filter
                LocalDate horizon = today.plusDays(filters.resolvedHorizonDays());
                return !targetDate.isAfter(horizon);
            }
            return true;
        }
        return false;
    }

    /**
     * Sort order:
     * 1. OVERDUE — highest daysOverdue first (most urgent).
     * 2. DUE_SOON — nearest targetDate first.
     * 3. UPCOMING — nearest targetDate first.
     */
    private Comparator<VaccinationQueueEntry> urgencyComparator() {
        return Comparator
                .<VaccinationQueueEntry, Integer>comparing(e -> statusOrdinal(e.status()))
                .thenComparing(e -> {
                    // OVERDUE: sort by daysOverdue DESC (negate for natural order)
                    if (e.status() == VaccinationCalendarStatus.OVERDUE) return -e.daysOverdue();
                    // DUE_SOON / UPCOMING: sort by targetDate ASC
                    return e.targetDate() != null ? (int) ChronoUnit.DAYS.between(LocalDate.now(), e.targetDate()) : 0;
                });
    }

    private static int statusOrdinal(VaccinationCalendarStatus s) {
        return switch (s) {
            case OVERDUE  -> 0;
            case DUE_SOON -> 1;
            case UPCOMING -> 2;
            default       -> 3;
        };
    }
}
