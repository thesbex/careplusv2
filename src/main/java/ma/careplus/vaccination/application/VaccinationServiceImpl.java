package ma.careplus.vaccination.application;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import ma.careplus.identity.infrastructure.persistence.UserRepository;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.vaccination.domain.VaccinationCalendarStatus;
import ma.careplus.vaccination.domain.VaccinationDose;
import ma.careplus.vaccination.domain.VaccinationStatus;
import ma.careplus.vaccination.domain.VaccineCatalog;
import ma.careplus.vaccination.domain.VaccineScheduleDose;
import ma.careplus.vaccination.infrastructure.persistence.VaccinationDoseRepository;
import ma.careplus.vaccination.infrastructure.persistence.VaccineCatalogRepository;
import ma.careplus.vaccination.infrastructure.persistence.VaccineScheduleDoseRepository;
import ma.careplus.vaccination.infrastructure.web.dto.DeferDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.RecordDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.UpdateDoseRequest;
import ma.careplus.vaccination.infrastructure.web.dto.VaccinationCalendarEntry;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * VaccinationService — patient-level vaccination calendar and dose management.
 *
 * <p>Cross-module dependency on PatientRepository is an accepted exception
 * (same precedent as BillingService, CatalogService). Logged in PROGRESS.md.
 */
@Service
@Transactional
public class VaccinationServiceImpl implements VaccinationService {

    /** 5 years in days — adult edge-case cutoff for computed calendar entries. */
    private static final int ADULT_CUTOFF_DAYS = 5 * 365;

    private final PatientRepository patientRepo;
    private final VaccinationDoseRepository doseRepo;
    private final VaccineCatalogRepository catalogRepo;
    private final VaccineScheduleDoseRepository scheduleRepo;
    private final UserRepository userRepo;
    private final JdbcTemplate jdbc;

    public VaccinationServiceImpl(
            PatientRepository patientRepo,
            VaccinationDoseRepository doseRepo,
            VaccineCatalogRepository catalogRepo,
            VaccineScheduleDoseRepository scheduleRepo,
            UserRepository userRepo,
            JdbcTemplate jdbc) {
        this.patientRepo = patientRepo;
        this.doseRepo = doseRepo;
        this.catalogRepo = catalogRepo;
        this.scheduleRepo = scheduleRepo;
        this.userRepo = userRepo;
        this.jdbc = jdbc;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // materializeCalendar
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<VaccinationCalendarEntry> materializeCalendar(UUID patientId) {
        var patient = patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        LocalDate birthDate = patient.getBirthDate();
        if (birthDate == null) {
            return List.of();
        }

        LocalDate today = LocalDate.now();

        // All non-deleted persisted doses for this patient
        List<VaccinationDose> persisted = doseRepo.findByPatientIdAndDeletedAtIsNull(patientId);

        // Index persisted doses by (vaccineId, doseNumber) for fast lookup
        Map<String, VaccinationDose> persistedByKey = persisted.stream()
                .filter(d -> d.getScheduleDoseId() != null) // only schedule-linked
                .collect(Collectors.toMap(
                        d -> doseKey(d.getVaccineId(), d.getDoseNumber()),
                        Function.identity(),
                        (a, b) -> a // keep first if duplicates (shouldn't happen)
                ));

        // Load all schedule doses joined to active catalog entries
        List<VaccineScheduleDose> schedule = scheduleRepo.findAllByOrderByTargetAgeDaysAsc();

        // Build catalog index for active vaccines
        Map<UUID, VaccineCatalog> catalogById = catalogRepo.findAll().stream()
                .filter(VaccineCatalog::isActive)
                .collect(Collectors.toMap(VaccineCatalog::getId, Function.identity()));

        List<VaccinationCalendarEntry> result = new ArrayList<>();

        for (VaccineScheduleDose sched : schedule) {
            VaccineCatalog catalog = catalogById.get(sched.getVaccineId());
            if (catalog == null) {
                // Vaccine is inactive or doesn't exist — skip this schedule row
                continue;
            }

            LocalDate targetDate = birthDate.plusDays(sched.getTargetAgeDays());
            int toleranceDays = sched.getToleranceDays();

            String key = doseKey(sched.getVaccineId(), sched.getDoseNumber());
            VaccinationDose dose = persistedByKey.get(key);

            if (dose != null) {
                // Persisted row — use its status
                result.add(toEntryFromDose(dose, catalog, sched, targetDate, toleranceDays));
            } else {
                // Compute on the fly
                // Adult edge-case: skip if today > targetDate + tolerance + 5 years
                LocalDate cutoff = targetDate.plusDays(toleranceDays).plusDays(ADULT_CUTOFF_DAYS);
                if (today.isAfter(cutoff)) {
                    continue;
                }

                VaccinationCalendarStatus computedStatus = computeStatus(today, targetDate, toleranceDays);
                result.add(new VaccinationCalendarEntry(
                        null,              // id — not persisted
                        sched.getId(),     // scheduleDoseId
                        catalog.getId(),
                        catalog.getCode(),
                        catalog.getNameFr(),
                        sched.getDoseNumber(),
                        sched.getLabelFr(),
                        targetDate,
                        toleranceDays,
                        computedStatus,
                        null, null, null, null, null, null, null, null
                ));
            }
        }

        // Append off-schedule doses (scheduleDoseId == null) — always returned
        persisted.stream()
                .filter(d -> d.getScheduleDoseId() == null)
                .forEach(d -> {
                    VaccineCatalog catalog = catalogRepo.findById(d.getVaccineId()).orElse(null);
                    if (catalog != null) {
                        // For off-schedule doses, targetDate = administeredAt date (or today if PLANNED)
                        LocalDate targetDate = d.getAdministeredAt() != null
                                ? d.getAdministeredAt().toLocalDate()
                                : today;
                        result.add(toEntryFromDose(d, catalog, null, targetDate, 0));
                    }
                });

        // Sort: schedule entries by targetDate ASC, off-schedule appended at end
        result.sort(Comparator.comparing(
                e -> e.targetDate() != null ? e.targetDate() : LocalDate.MAX));

        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // recordDose
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public VaccinationCalendarEntry recordDose(UUID patientId, RecordDoseRequest request) {
        patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        // Idempotence guard
        if (doseRepo.existsByPatientIdAndVaccineIdAndDoseNumberAndDeletedAtIsNull(
                patientId, request.vaccineId(), (short) request.doseNumber())) {
            throw new BusinessException("VACCINATION_ALREADY_RECORDED",
                    "La dose " + request.doseNumber() + " du vaccin a déjà été saisie pour ce patient.", 409);
        }

        // Validate vaccine exists
        VaccineCatalog catalog = catalogRepo.findById(request.vaccineId())
                .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND",
                        "Vaccin introuvable : " + request.vaccineId()));

        // Validate scheduleDoseId if provided
        VaccineScheduleDose sched = null;
        if (request.scheduleDoseId() != null) {
            sched = scheduleRepo.findById(request.scheduleDoseId())
                    .orElseThrow(() -> new NotFoundException("VAC_SCHED_NOT_FOUND",
                            "Dose de calendrier introuvable : " + request.scheduleDoseId()));
            if (!sched.getVaccineId().equals(request.vaccineId())) {
                throw new BusinessException("VAC_SCHED_VACCINE_MISMATCH",
                        "La dose de calendrier ne correspond pas au vaccin fourni.", 422);
            }
        }

        VaccinationDose dose = new VaccinationDose();
        dose.setPatientId(patientId);
        dose.setVaccineId(request.vaccineId());
        dose.setDoseNumber((short) request.doseNumber());
        dose.setScheduleDoseId(request.scheduleDoseId());
        dose.setStatus(VaccinationStatus.ADMINISTERED);
        dose.setAdministeredAt(request.administeredAt());
        dose.setLotNumber(request.lotNumber());
        dose.setRoute(request.route());
        dose.setSite(request.site());
        dose.setAdministeredBy(request.administeredBy());
        dose.setNotes(request.notes());
        dose = doseRepo.save(dose);

        // Update patient.vaccination_started_at if null
        jdbc.update(
                "UPDATE patient_patient SET vaccination_started_at = ? "
                + "WHERE id = ? AND vaccination_started_at IS NULL",
                OffsetDateTime.now(), patientId);

        LocalDate targetDate = computeTargetDate(patientId, sched);
        return toEntryFromDose(dose, catalog, sched, targetDate, sched != null ? sched.getToleranceDays() : 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // deferDose
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public VaccinationCalendarEntry deferDose(UUID patientId, UUID doseId, DeferDoseRequest request) {
        patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        // Try finding by row id first
        Optional<VaccinationDose> existing = doseRepo.findById(doseId)
                .filter(d -> d.getPatientId().equals(patientId) && d.getDeletedAt() == null);

        VaccinationDose dose;
        VaccineCatalog catalog;
        VaccineScheduleDose sched = null;

        if (existing.isPresent()) {
            dose = existing.get();
            final UUID doseVaccineId = dose.getVaccineId();
            catalog = catalogRepo.findById(doseVaccineId)
                    .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND",
                            "Vaccin introuvable : " + doseVaccineId));
            if (dose.getScheduleDoseId() != null) {
                sched = scheduleRepo.findById(dose.getScheduleDoseId()).orElse(null);
            }
        } else {
            // doseId might be a scheduleDoseId — materialise the row
            sched = scheduleRepo.findById(doseId)
                    .orElseThrow(() -> new NotFoundException("VAC_DOSE_NOT_FOUND",
                            "Dose introuvable : " + doseId));
            final UUID schedVaccineId = sched.getVaccineId();
            catalog = catalogRepo.findById(schedVaccineId)
                    .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND",
                            "Vaccin introuvable : " + schedVaccineId));
            dose = materializeDose(patientId, sched, VaccinationStatus.DEFERRED);
        }

        dose.setStatus(VaccinationStatus.DEFERRED);
        dose.setDeferralReason(request.reason());
        dose = doseRepo.save(dose);

        LocalDate targetDate = computeTargetDate(patientId, sched);
        return toEntryFromDose(dose, catalog, sched, targetDate, sched != null ? sched.getToleranceDays() : 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // skipDose
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public VaccinationCalendarEntry skipDose(UUID patientId, UUID doseId) {
        patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        Optional<VaccinationDose> existing = doseRepo.findById(doseId)
                .filter(d -> d.getPatientId().equals(patientId) && d.getDeletedAt() == null);

        VaccinationDose dose;
        VaccineCatalog catalog;
        VaccineScheduleDose sched = null;

        if (existing.isPresent()) {
            dose = existing.get();
            final UUID doseVaccineId2 = dose.getVaccineId();
            catalog = catalogRepo.findById(doseVaccineId2)
                    .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND",
                            "Vaccin introuvable : " + doseVaccineId2));
            if (dose.getScheduleDoseId() != null) {
                sched = scheduleRepo.findById(dose.getScheduleDoseId()).orElse(null);
            }
        } else {
            sched = scheduleRepo.findById(doseId)
                    .orElseThrow(() -> new NotFoundException("VAC_DOSE_NOT_FOUND",
                            "Dose introuvable : " + doseId));
            final UUID schedVaccineId2 = sched.getVaccineId();
            catalog = catalogRepo.findById(schedVaccineId2)
                    .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND",
                            "Vaccin introuvable : " + schedVaccineId2));
            dose = materializeDose(patientId, sched, VaccinationStatus.SKIPPED);
        }

        dose.setStatus(VaccinationStatus.SKIPPED);
        dose = doseRepo.save(dose);

        LocalDate targetDate = computeTargetDate(patientId, sched);
        return toEntryFromDose(dose, catalog, sched, targetDate, sched != null ? sched.getToleranceDays() : 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // updateDose
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public VaccinationCalendarEntry updateDose(UUID patientId, UUID doseId, UpdateDoseRequest request) {
        patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        VaccinationDose dose = doseRepo.findById(doseId)
                .filter(d -> d.getPatientId().equals(patientId) && d.getDeletedAt() == null)
                .orElseThrow(() -> new NotFoundException("VAC_DOSE_NOT_FOUND",
                        "Dose introuvable : " + doseId));

        // Optimistic locking check
        if (dose.getVersion() != request.version()) {
            throw new BusinessException("OPTIMISTIC_LOCK_CONFLICT",
                    "La dose a été modifiée par un autre utilisateur. Rechargez et réessayez.", 409);
        }

        if (request.administeredAt() != null) dose.setAdministeredAt(request.administeredAt());
        if (request.lotNumber() != null) dose.setLotNumber(request.lotNumber());
        if (request.route() != null) dose.setRoute(request.route());
        if (request.site() != null) dose.setSite(request.site());
        if (request.administeredBy() != null) dose.setAdministeredBy(request.administeredBy());
        if (request.deferralReason() != null) dose.setDeferralReason(request.deferralReason());
        if (request.notes() != null) dose.setNotes(request.notes());

        try {
            dose = doseRepo.save(dose);
        } catch (ObjectOptimisticLockingFailureException ex) {
            throw new BusinessException("OPTIMISTIC_LOCK_CONFLICT",
                    "La dose a été modifiée par un autre utilisateur. Rechargez et réessayez.", 409);
        }

        final UUID updatedVaccineId = dose.getVaccineId();
        VaccineCatalog catalog = catalogRepo.findById(updatedVaccineId)
                .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND",
                        "Vaccin introuvable : " + updatedVaccineId));

        VaccineScheduleDose sched = null;
        if (dose.getScheduleDoseId() != null) {
            sched = scheduleRepo.findById(dose.getScheduleDoseId()).orElse(null);
        }

        LocalDate targetDate = computeTargetDate(patientId, sched);
        return toEntryFromDose(dose, catalog, sched, targetDate, sched != null ? sched.getToleranceDays() : 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // softDelete
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public void softDelete(UUID patientId, UUID doseId) {
        patientRepo.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        VaccinationDose dose = doseRepo.findById(doseId)
                .filter(d -> d.getPatientId().equals(patientId) && d.getDeletedAt() == null)
                .orElseThrow(() -> new NotFoundException("VAC_DOSE_NOT_FOUND",
                        "Dose introuvable : " + doseId));

        dose.setDeletedAt(OffsetDateTime.now());
        doseRepo.save(dose);
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
            // today <= dueSoonStart - 1, i.e. today < dueSoonStart
            return VaccinationCalendarStatus.UPCOMING;
        } else if (!today.isAfter(dueSoonEnd)) {
            return VaccinationCalendarStatus.DUE_SOON;
        } else {
            return VaccinationCalendarStatus.OVERDUE;
        }
    }

    private static VaccinationCalendarStatus toCalendarStatus(VaccinationStatus status) {
        return switch (status) {
            case ADMINISTERED -> VaccinationCalendarStatus.ADMINISTERED;
            case DEFERRED     -> VaccinationCalendarStatus.DEFERRED;
            case SKIPPED      -> VaccinationCalendarStatus.SKIPPED;
            case PLANNED      -> VaccinationCalendarStatus.UPCOMING; // fallback
        };
    }

    /**
     * Builds a VaccinationCalendarEntry from a persisted VaccinationDose.
     * For ADMINISTERED/DEFERRED/SKIPPED, the persisted status is used directly.
     * For PLANNED (rare), we recompute the status from today vs targetDate.
     */
    private VaccinationCalendarEntry toEntryFromDose(
            VaccinationDose dose,
            VaccineCatalog catalog,
            VaccineScheduleDose sched,
            LocalDate targetDate,
            int toleranceDays) {

        VaccinationCalendarStatus calStatus;
        if (dose.getStatus() == VaccinationStatus.PLANNED) {
            calStatus = targetDate != null
                    ? computeStatus(LocalDate.now(), targetDate, toleranceDays)
                    : VaccinationCalendarStatus.UPCOMING;
        } else {
            calStatus = toCalendarStatus(dose.getStatus());
        }

        String administeredByName = null;
        if (dose.getAdministeredBy() != null) {
            administeredByName = userRepo.findById(dose.getAdministeredBy())
                    .map(u -> u.getFirstName() + " " + u.getLastName())
                    .orElse(null);
        }

        String doseLabel = sched != null ? sched.getLabelFr() : null;
        int doseToleranceDays = sched != null ? sched.getToleranceDays() : toleranceDays;

        return new VaccinationCalendarEntry(
                dose.getId(),
                dose.getScheduleDoseId(),
                catalog.getId(),
                catalog.getCode(),
                catalog.getNameFr(),
                dose.getDoseNumber(),
                doseLabel,
                targetDate,
                doseToleranceDays,
                calStatus,
                dose.getAdministeredAt(),
                dose.getLotNumber(),
                dose.getRoute(),
                dose.getSite(),
                administeredByName,
                dose.getDeferralReason(),
                dose.getNotes(),
                dose.getVersion()
        );
    }

    /**
     * Materialises a VaccinationDose row from a schedule entry with the given status.
     * Used for defer/skip on computed (not yet persisted) entries.
     */
    private VaccinationDose materializeDose(UUID patientId, VaccineScheduleDose sched,
                                             VaccinationStatus status) {
        VaccinationDose dose = new VaccinationDose();
        dose.setPatientId(patientId);
        dose.setVaccineId(sched.getVaccineId());
        dose.setDoseNumber(sched.getDoseNumber());
        dose.setScheduleDoseId(sched.getId());
        dose.setStatus(status);
        return doseRepo.save(dose);
    }

    /**
     * Computes the target date for a dose given this patient's birth date.
     * Returns today if no birth date or no schedule entry.
     */
    private LocalDate computeTargetDate(UUID patientId, VaccineScheduleDose sched) {
        if (sched == null) return LocalDate.now();
        return patientRepo.findActiveById(patientId)
                .map(p -> p.getBirthDate() != null
                        ? p.getBirthDate().plusDays(sched.getTargetAgeDays())
                        : LocalDate.now())
                .orElse(LocalDate.now());
    }
}
