package ma.careplus.vaccination.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.vaccination.domain.VaccineCatalog;
import ma.careplus.vaccination.domain.VaccineScheduleDose;
import ma.careplus.vaccination.infrastructure.persistence.VaccineCatalogRepository;
import ma.careplus.vaccination.infrastructure.persistence.VaccineScheduleDoseRepository;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineCatalogWriteRequest;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineScheduleDoseWriteRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class VaccinationCatalogServiceImpl implements VaccinationCatalogService {

    private final VaccineCatalogRepository catalogRepo;
    private final VaccineScheduleDoseRepository scheduleRepo;

    public VaccinationCatalogServiceImpl(VaccineCatalogRepository catalogRepo,
                                          VaccineScheduleDoseRepository scheduleRepo) {
        this.catalogRepo = catalogRepo;
        this.scheduleRepo = scheduleRepo;
    }

    // ── Vaccine catalog ───────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<VaccineCatalog> listCatalog() {
        return catalogRepo.findAll();
    }

    @Override
    public VaccineCatalog createCatalog(VaccineCatalogWriteRequest req) {
        if (catalogRepo.existsByCode(req.code())) {
            throw new BusinessException("VAC_DUPLICATE_CODE",
                    "Un vaccin avec le code « " + req.code() + " » existe déjà.", 409);
        }
        VaccineCatalog v = new VaccineCatalog();
        v.setCode(req.code());
        v.setNameFr(req.nameFr());
        v.setManufacturerDefault(req.manufacturerDefault());
        v.setRouteDefault(req.routeDefault());
        v.setPni(req.isPni());
        v.setActive(true);
        return catalogRepo.save(v);
    }

    @Override
    public VaccineCatalog updateCatalog(UUID id, VaccineCatalogWriteRequest req) {
        VaccineCatalog v = catalogRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND", "Vaccin introuvable : " + id));
        // Check duplicate code on other rows
        catalogRepo.findByCode(req.code())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new BusinessException("VAC_DUPLICATE_CODE",
                            "Un vaccin avec le code « " + req.code() + " » existe déjà.", 409);
                });
        v.setCode(req.code());
        v.setNameFr(req.nameFr());
        v.setManufacturerDefault(req.manufacturerDefault());
        v.setRouteDefault(req.routeDefault());
        // is_pni is not updatable via the API — only the seed sets it
        return catalogRepo.save(v);
    }

    @Override
    public void deactivateCatalog(UUID id) {
        VaccineCatalog v = catalogRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("VAC_NOT_FOUND", "Vaccin introuvable : " + id));
        if (v.isPni()) {
            throw new BusinessException("PNI_PROTECTED",
                    "Les vaccins du PNI ne peuvent pas être supprimés.", 422);
        }
        v.setActive(false);
        catalogRepo.save(v);
    }

    // ── Vaccine schedule ──────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<VaccineScheduleDose> listSchedule() {
        return scheduleRepo.findAllByOrderByTargetAgeDaysAsc();
    }

    @Override
    @Transactional(readOnly = true)
    public List<VaccineScheduleDose> listScheduleByVaccine(UUID vaccineId) {
        return scheduleRepo.findByVaccineIdOrderByDoseNumberAsc(vaccineId);
    }

    @Override
    public VaccineScheduleDose createSchedule(VaccineScheduleDoseWriteRequest req) {
        // Vaccine must exist
        if (!catalogRepo.existsById(req.vaccineId())) {
            throw new NotFoundException("VAC_NOT_FOUND", "Vaccin introuvable : " + req.vaccineId());
        }
        // UNIQUE(vaccine_id, dose_number) — check before insert for a clear 409
        if (scheduleRepo.existsByVaccineIdAndDoseNumber(req.vaccineId(), req.doseNumber())) {
            throw new BusinessException("VAC_SCHEDULE_DUPLICATE",
                    "La dose " + req.doseNumber() + " pour ce vaccin est déjà planifiée.", 409);
        }
        VaccineScheduleDose d = new VaccineScheduleDose();
        d.setVaccineId(req.vaccineId());
        d.setDoseNumber(req.doseNumber());
        d.setTargetAgeDays(req.targetAgeDays());
        d.setToleranceDays(req.toleranceDays() > 0 ? req.toleranceDays() : 30);
        d.setLabelFr(req.labelFr());
        try {
            return scheduleRepo.save(d);
        } catch (DataIntegrityViolationException ex) {
            throw new BusinessException("VAC_SCHEDULE_DUPLICATE",
                    "La dose " + req.doseNumber() + " pour ce vaccin est déjà planifiée.", 409);
        }
    }

    @Override
    public VaccineScheduleDose updateSchedule(UUID id, VaccineScheduleDoseWriteRequest req) {
        VaccineScheduleDose d = scheduleRepo.findById(id)
                .orElseThrow(() -> new NotFoundException("VAC_SCHED_NOT_FOUND", "Dose de calendrier introuvable : " + id));
        // Validate vaccine exists if changing it
        if (!req.vaccineId().equals(d.getVaccineId()) && !catalogRepo.existsById(req.vaccineId())) {
            throw new NotFoundException("VAC_NOT_FOUND", "Vaccin introuvable : " + req.vaccineId());
        }
        // Check for duplicate (vaccine_id, dose_number) on other rows
        if (scheduleRepo.existsByVaccineIdAndDoseNumber(req.vaccineId(), req.doseNumber())) {
            // Allow if it's the same row
            scheduleRepo.findByVaccineIdOrderByDoseNumberAsc(req.vaccineId()).stream()
                    .filter(other -> other.getDoseNumber() == req.doseNumber()
                            && !other.getId().equals(id))
                    .findFirst()
                    .ifPresent(other -> {
                        throw new BusinessException("VAC_SCHEDULE_DUPLICATE",
                                "La dose " + req.doseNumber() + " pour ce vaccin est déjà planifiée.", 409);
                    });
        }
        d.setVaccineId(req.vaccineId());
        d.setDoseNumber(req.doseNumber());
        d.setTargetAgeDays(req.targetAgeDays());
        d.setToleranceDays(req.toleranceDays() > 0 ? req.toleranceDays() : 30);
        d.setLabelFr(req.labelFr());
        return scheduleRepo.save(d);
    }

    @Override
    public void deleteSchedule(UUID id) {
        if (!scheduleRepo.existsById(id)) {
            throw new NotFoundException("VAC_SCHED_NOT_FOUND", "Dose de calendrier introuvable : " + id);
        }
        scheduleRepo.deleteById(id);
    }
}
