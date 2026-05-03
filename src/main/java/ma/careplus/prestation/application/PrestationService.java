package ma.careplus.prestation.application;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.prestation.domain.ConsultationPrestation;
import ma.careplus.prestation.domain.Prestation;
import ma.careplus.prestation.infrastructure.persistence.ConsultationPrestationRepository;
import ma.careplus.prestation.infrastructure.persistence.PrestationRepository;
import ma.careplus.prestation.infrastructure.web.dto.AddPrestationRequest;
import ma.careplus.prestation.infrastructure.web.dto.ConsultationPrestationView;
import ma.careplus.prestation.infrastructure.web.dto.PrestationRequest;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Catalogue prestations + lien vers consultation (V016).
 *
 * Les opérations de mutation s'arrêtent si la consultation référencée
 * est SIGNEE (immuable, J6 — voir ConsultationService.update). On
 * snapshot le tarif au moment de l'ajout pour qu'une mise à jour
 * ultérieure du catalogue ne réécrive pas l'historique.
 */
@Service
public class PrestationService {

    private final PrestationRepository prestationRepository;
    private final ConsultationPrestationRepository linkRepository;
    private final JdbcTemplate jdbc;

    public PrestationService(PrestationRepository prestationRepository,
                             ConsultationPrestationRepository linkRepository,
                             JdbcTemplate jdbc) {
        this.prestationRepository = prestationRepository;
        this.linkRepository = linkRepository;
        this.jdbc = jdbc;
    }

    // ── Catalogue ─────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<Prestation> listAll(boolean includeInactive) {
        return includeInactive ? prestationRepository.findAllOrdered() : prestationRepository.findActive();
    }

    @Transactional
    public Prestation create(PrestationRequest req) {
        prestationRepository.findByCode(req.code()).ifPresent(p -> {
            throw new BusinessException("PRESTATION_CODE_DUPLICATE",
                    "Une prestation avec le code '" + req.code() + "' existe déjà.",
                    HttpStatus.CONFLICT.value());
        });
        Prestation p = new Prestation();
        p.setCode(req.code());
        p.setLabel(req.label());
        p.setDefaultPrice(req.defaultPrice() != null ? req.defaultPrice() : BigDecimal.ZERO);
        p.setActive(req.active() == null ? true : req.active());
        p.setSortOrder(req.sortOrder() == null ? 0 : req.sortOrder());
        return prestationRepository.save(p);
    }

    @Transactional
    public Prestation update(UUID id, PrestationRequest req) {
        Prestation p = prestationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("PRESTATION_NOT_FOUND",
                        "Prestation introuvable.", HttpStatus.NOT_FOUND.value()));
        // Si on change le code, vérifier l'unicité.
        if (!p.getCode().equals(req.code())) {
            prestationRepository.findByCode(req.code()).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new BusinessException("PRESTATION_CODE_DUPLICATE",
                            "Une prestation avec le code '" + req.code() + "' existe déjà.",
                            HttpStatus.CONFLICT.value());
                }
            });
        }
        p.setCode(req.code());
        p.setLabel(req.label());
        if (req.defaultPrice() != null) p.setDefaultPrice(req.defaultPrice());
        if (req.active() != null) p.setActive(req.active());
        if (req.sortOrder() != null) p.setSortOrder(req.sortOrder());
        return p;
    }

    @Transactional
    public void deactivate(UUID id) {
        Prestation p = prestationRepository.findById(id)
                .orElseThrow(() -> new BusinessException("PRESTATION_NOT_FOUND",
                        "Prestation introuvable.", HttpStatus.NOT_FOUND.value()));
        p.setActive(false);
    }

    // ── Lien consultation × prestation ────────────────────────────────────

    @Transactional
    public ConsultationPrestation addToConsultation(UUID consultationId, AddPrestationRequest req) {
        ensureConsultationMutable(consultationId);
        Prestation prestation = prestationRepository.findById(req.prestationId())
                .orElseThrow(() -> new BusinessException("PRESTATION_NOT_FOUND",
                        "Prestation introuvable.", HttpStatus.NOT_FOUND.value()));
        if (!prestation.isActive()) {
            throw new BusinessException("PRESTATION_INACTIVE",
                    "Cette prestation est désactivée et ne peut être ajoutée.",
                    HttpStatus.BAD_REQUEST.value());
        }
        ConsultationPrestation link = new ConsultationPrestation();
        link.setConsultationId(consultationId);
        link.setPrestationId(prestation.getId());
        link.setUnitPrice(req.unitPrice() != null ? req.unitPrice() : prestation.getDefaultPrice());
        link.setQuantity(req.quantity() == null ? 1 : req.quantity());
        link.setNotes(req.notes());
        return linkRepository.save(link);
    }

    @Transactional
    public void removeFromConsultation(UUID consultationId, UUID linkId) {
        ensureConsultationMutable(consultationId);
        ConsultationPrestation link = linkRepository.findById(linkId)
                .orElseThrow(() -> new BusinessException("CONSULTATION_PRESTATION_NOT_FOUND",
                        "Lien prestation introuvable.", HttpStatus.NOT_FOUND.value()));
        if (!link.getConsultationId().equals(consultationId)) {
            throw new BusinessException("CONSULTATION_PRESTATION_MISMATCH",
                    "Cette prestation n'appartient pas à la consultation indiquée.",
                    HttpStatus.BAD_REQUEST.value());
        }
        linkRepository.deleteById(linkId);
    }

    @Transactional(readOnly = true)
    public List<ConsultationPrestationView> listForConsultation(UUID consultationId) {
        List<ConsultationPrestation> links = linkRepository.findByConsultationIdOrderByCreatedAtAsc(consultationId);
        if (links.isEmpty()) return List.of();
        Map<UUID, Prestation> byId = prestationRepository.findAllById(
                        links.stream().map(ConsultationPrestation::getPrestationId).toList())
                .stream().collect(Collectors.toMap(Prestation::getId, p -> p));
        return links.stream()
                .map(link -> {
                    Prestation p = byId.get(link.getPrestationId());
                    return ConsultationPrestationView.of(link,
                            p != null ? p.getCode() : "?",
                            p != null ? p.getLabel() : "(supprimée)");
                })
                .toList();
    }

    /**
     * Total des prestations d'une consultation. Utilisé par le module
     * facturation pour intégrer ces lignes dans le total facture.
     */
    @Transactional(readOnly = true)
    public BigDecimal totalForConsultation(UUID consultationId) {
        return linkRepository.findByConsultationIdOrderByCreatedAtAsc(consultationId).stream()
                .map(l -> l.getUnitPrice().multiply(BigDecimal.valueOf(l.getQuantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private void ensureConsultationMutable(UUID consultationId) {
        String status = jdbc.queryForObject(
                "SELECT status FROM clinical_consultation WHERE id = ?",
                String.class, consultationId);
        if (status == null) {
            throw new BusinessException("CONSULTATION_NOT_FOUND",
                    "Consultation introuvable.", HttpStatus.NOT_FOUND.value());
        }
        if ("SIGNEE".equals(status) || "FINALISEE".equals(status)) {
            throw new BusinessException("CONSULT_LOCKED",
                    "Une consultation signée ne peut plus être modifiée.",
                    HttpStatus.CONFLICT.value());
        }
    }
}
