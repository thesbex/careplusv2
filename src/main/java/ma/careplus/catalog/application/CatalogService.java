package ma.careplus.catalog.application;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.catalog.domain.Act;
import ma.careplus.catalog.domain.Medication;
import ma.careplus.catalog.domain.Tariff;
import ma.careplus.catalog.infrastructure.persistence.ActRepository;
import ma.careplus.catalog.infrastructure.persistence.MedicationRepository;
import ma.careplus.catalog.infrastructure.persistence.TariffRepository;
import ma.careplus.catalog.infrastructure.web.dto.ActRequest;
import ma.careplus.catalog.infrastructure.web.dto.TariffRequest;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Catalog write-side: acts, tariffs, medication search.
 * Tariff lifecycle: adding a new tariff closes the previous open row
 * for the same act + tier by setting effectiveTo = newEffectiveFrom - 1 day.
 */
@Service
@Transactional
public class CatalogService {

    private final ActRepository actRepository;
    private final TariffRepository tariffRepository;
    private final MedicationRepository medicationRepository;

    public CatalogService(ActRepository actRepository,
                          TariffRepository tariffRepository,
                          MedicationRepository medicationRepository) {
        this.actRepository = actRepository;
        this.tariffRepository = tariffRepository;
        this.medicationRepository = medicationRepository;
    }

    // ── Acts ──────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Act> getActs() {
        return actRepository.findAllByActiveTrue();
    }

    public Act createAct(ActRequest req, UUID createdBy) {
        Act act = new Act();
        act.setCode(req.code());
        act.setName(req.name());
        if (req.type() != null) act.setType(req.type());
        act.setActive(true);
        return actRepository.save(act);
    }

    public Act updateAct(UUID actId, ActRequest req, UUID actorId) {
        Act act = actRepository.findById(actId)
                .orElseThrow(() -> new NotFoundException("ACT_NOT_FOUND", "Acte introuvable : " + actId));
        act.setName(req.name());
        if (req.type() != null) act.setType(req.type());
        return act;
    }

    public void deactivateAct(UUID actId, UUID actorId) {
        Act act = actRepository.findById(actId)
                .orElseThrow(() -> new NotFoundException("ACT_NOT_FOUND", "Acte introuvable : " + actId));
        act.setActive(false);
    }

    // ── Tariffs ───────────────────────────────────────────────────────────────

    public Tariff addTariff(UUID actId, TariffRequest req, UUID actorId) {
        // Ensure act exists
        actRepository.findById(actId)
                .orElseThrow(() -> new NotFoundException("ACT_NOT_FOUND", "Acte introuvable : " + actId));

        // Close any currently open tariff for same act + tier
        List<Tariff> openTariffs = tariffRepository.findOpenTariffs(actId, req.tier());
        LocalDate closeDate = req.effectiveFrom().minusDays(1);
        for (Tariff open : openTariffs) {
            open.setEffectiveTo(closeDate);
        }

        Tariff tariff = new Tariff();
        tariff.setActId(actId);
        tariff.setTier(req.tier());
        tariff.setAmount(req.amount());
        tariff.setEffectiveFrom(req.effectiveFrom());
        return tariffRepository.save(tariff);
    }

    @Transactional(readOnly = true)
    public List<Tariff> getTariffsForAct(UUID actId) {
        return tariffRepository.findByActIdOrderByEffectiveFromDesc(actId);
    }

    @Transactional(readOnly = true)
    public Optional<Tariff> getEffectiveTariff(UUID actId, String tier, LocalDate at) {
        return tariffRepository.findEffectiveTariff(actId, tier, at);
    }

    // ── Medications ───────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Medication> searchMedications(String q) {
        if (q == null || q.isBlank()) {
            return medicationRepository.findAll().stream()
                    .filter(Medication::isActive)
                    .limit(20)
                    .toList();
        }
        return medicationRepository.searchByNameOrDci(q.trim());
    }

    @Transactional(readOnly = true)
    public Optional<Medication> findMedicationById(UUID id) {
        return medicationRepository.findById(id);
    }
}
