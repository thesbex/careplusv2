package ma.careplus.pregnancy.application;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyStatus;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyVisitRepository;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pregnancy worklist — Étape 3.
 *
 * <p>Loads all EN_COURS pregnancies, joins with Patient for name data,
 * computes SA + trimester + last visit timestamp, then applies filters and paginates
 * in-memory. Acceptable at MVP scale (GP cabinet: max 50 active pregnancies).
 *
 * <p>Cross-module read on PatientRepository: accepted exception, same precedent as
 * VaccinationQueueServiceImpl, BillingService, CatalogService.
 */
@Service
@Transactional(readOnly = true)
public class PregnancyQueueServiceImpl implements PregnancyQueueService {

    private final PregnancyRepository pregnancyRepo;
    private final PregnancyVisitRepository visitRepo;
    private final PatientRepository patientRepo;
    private final PregnancyAlertService alertService;

    public PregnancyQueueServiceImpl(PregnancyRepository pregnancyRepo,
                                      PregnancyVisitRepository visitRepo,
                                      PatientRepository patientRepo,
                                      PregnancyAlertService alertService) {
        this.pregnancyRepo = pregnancyRepo;
        this.visitRepo = visitRepo;
        this.patientRepo = patientRepo;
        this.alertService = alertService;
    }

    @Override
    public PageView<PregnancyQueueEntry> queue(QueueFilters filters) {
        LocalDate today = LocalDate.now();

        // 1. Load all active pregnancies
        List<Pregnancy> active = pregnancyRepo.findByStatus(PregnancyStatus.EN_COURS);

        // 2. Build entries
        List<PregnancyQueueEntry> entries = new ArrayList<>();
        List<UUID> idsForAlertBatch = active.stream().map(Pregnancy::getId).toList();

        // Batch alert count — avoids N individual queries
        Map<UUID, Integer> alertCounts = alertService.countByPregnancy(idsForAlertBatch);

        for (Pregnancy p : active) {
            // Load patient
            Optional<Patient> patientOpt = patientRepo.findById(p.getPatientId());
            if (patientOpt.isEmpty()) continue; // Orphan row — skip

            Patient patient = patientOpt.get();

            // Name search filter (case-insensitive, partial)
            if (filters.q() != null && !filters.q().isBlank()) {
                String q = filters.q().toLowerCase();
                boolean matches =
                        (patient.getLastName() != null && patient.getLastName().toLowerCase().contains(q))
                        || (patient.getFirstName() != null && patient.getFirstName().toLowerCase().contains(q));
                if (!matches) continue;
            }

            // Compute SA
            int saWeeks = (int) ChronoUnit.WEEKS.between(p.getLmpDate(), today);
            String trimester = computeTrimester(saWeeks);

            // Trimester filter
            if (filters.trimester() != null && !filters.trimester().equalsIgnoreCase(trimester)) continue;

            // Last visit timestamp
            Optional<PregnancyVisit> lastVisit =
                    visitRepo.findFirstByPregnancyIdOrderByRecordedAtDesc(p.getId());
            java.time.Instant lastVisitAt = lastVisit.map(v -> v.getRecordedAt().toInstant()).orElse(null);

            // Alert count
            int alertCount = alertCounts.getOrDefault(p.getId(), 0);

            // withAlerts filter
            if (Boolean.TRUE.equals(filters.withAlerts()) && alertCount == 0) continue;

            entries.add(new PregnancyQueueEntry(
                    p.getId(),
                    p.getPatientId(),
                    patient.getLastName(),
                    patient.getFirstName(),
                    p.getLmpDate(),
                    p.getDueDate(),
                    saWeeks,
                    trimester,
                    lastVisitAt,
                    alertCount
            ));
        }

        // 3. Sort by SA descending (most advanced first)
        entries.sort(Comparator.comparingInt(PregnancyQueueEntry::saWeeks).reversed());

        // 4. Paginate
        int page = filters.resolvedPage();
        int size = filters.resolvedSize();
        long total = entries.size();

        int fromIndex = page * size;
        int toIndex = (int) Math.min(fromIndex + size, total);

        List<PregnancyQueueEntry> pageContent = fromIndex >= total
                ? List.of()
                : entries.subList(fromIndex, toIndex);

        return PageView.of(pageContent, total, page, size);
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * T1 < 14 weeks, T2 14–27 weeks, T3 ≥ 28 weeks.
     * Negative saWeeks (LMP in future) → T1.
     */
    private static String computeTrimester(int saWeeks) {
        if (saWeeks < 14)  return "T1";
        if (saWeeks < 28)  return "T2";
        return "T3";
    }
}
