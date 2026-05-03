package ma.careplus.vaccination.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccineCatalog;
import ma.careplus.vaccination.domain.VaccineScheduleDose;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineCatalogWriteRequest;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineScheduleDoseWriteRequest;

/**
 * Public API for vaccine catalog and schedule management.
 * Étape 1 scope: CRUD referential only.
 */
public interface VaccinationCatalogService {

    // ── Vaccine catalog ───────────────────────────────────────────────────────

    List<VaccineCatalog> listCatalog();

    VaccineCatalog createCatalog(VaccineCatalogWriteRequest req);

    VaccineCatalog updateCatalog(UUID id, VaccineCatalogWriteRequest req);

    /**
     * Soft-deactivate a vaccine (sets active=false).
     * Guard: PNI_PROTECTED (422) if is_pni=TRUE.
     */
    void deactivateCatalog(UUID id);

    // ── Vaccine schedule ──────────────────────────────────────────────────────

    List<VaccineScheduleDose> listSchedule();

    List<VaccineScheduleDose> listScheduleByVaccine(UUID vaccineId);

    VaccineScheduleDose createSchedule(VaccineScheduleDoseWriteRequest req);

    VaccineScheduleDose updateSchedule(UUID id, VaccineScheduleDoseWriteRequest req);

    void deleteSchedule(UUID id);
}
