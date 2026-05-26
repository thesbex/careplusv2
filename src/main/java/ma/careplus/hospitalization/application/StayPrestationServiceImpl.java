package ma.careplus.hospitalization.application;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.domain.Stay;
import ma.careplus.hospitalization.domain.StayPrestation;
import ma.careplus.hospitalization.infrastructure.persistence.StayPrestationRepository;
import ma.careplus.hospitalization.infrastructure.persistence.StayRepository;
import ma.careplus.hospitalization.infrastructure.web.dto.StayPrestationRequests.AddPrestationRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayPrestationView;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class StayPrestationServiceImpl implements StayPrestationService {

    private final StayPrestationRepository prestationRepo;
    private final StayRepository stayRepo;

    public StayPrestationServiceImpl(StayPrestationRepository prestationRepo,
                                     StayRepository stayRepo) {
        this.prestationRepo = prestationRepo;
        this.stayRepo = stayRepo;
    }

    @Override
    public StayPrestationView add(UUID stayId, AddPrestationRequest req, UUID actorId) {
        Stay stay = loadStayOrThrow(stayId);
        rejectIfInvoicedOrCancelled(stay);

        StayPrestation p = new StayPrestation();
        p.setStayId(stayId);
        p.setActId(req.actId());
        p.setLabel(req.label());
        p.setUnitPrice(req.unitPrice());
        p.setQuantity(req.quantity() != null ? req.quantity() : BigDecimal.ONE);
        p.setCreatedBy(actorId);
        p = prestationRepo.save(p);
        return toView(p);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StayPrestationView> list(UUID stayId) {
        // 404 si séjour inconnu
        loadStayOrThrow(stayId);
        return prestationRepo.findAllByStayIdOrderByPerformedAtAsc(stayId)
                .stream()
                .map(this::toView)
                .toList();
    }

    @Override
    public void delete(UUID stayId, UUID prestationId) {
        Stay stay = loadStayOrThrow(stayId);
        if ("FACTURE".equals(stay.getStatus())) {
            throw new BusinessException("STAY_ALREADY_INVOICED",
                    "Impossible de supprimer une prestation : le séjour est déjà facturé.", 409);
        }
        StayPrestation p = prestationRepo.findById(prestationId)
                .orElseThrow(() -> new NotFoundException("PRESTATION_NOT_FOUND",
                        "Prestation introuvable : " + prestationId));
        if (!p.getStayId().equals(stayId)) {
            throw new NotFoundException("PRESTATION_NOT_FOUND",
                    "Prestation introuvable pour ce séjour : " + prestationId);
        }
        prestationRepo.delete(p);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private Stay loadStayOrThrow(UUID stayId) {
        return stayRepo.findByIdAndDeletedAtIsNull(stayId)
                .orElseThrow(() -> new NotFoundException("STAY_NOT_FOUND",
                        "Séjour introuvable : " + stayId));
    }

    private static void rejectIfInvoicedOrCancelled(Stay stay) {
        if ("FACTURE".equals(stay.getStatus())) {
            throw new BusinessException("STAY_ALREADY_INVOICED",
                    "Impossible d'ajouter une prestation : le séjour est déjà facturé.", 409);
        }
        if ("ANNULE".equals(stay.getStatus())) {
            throw new BusinessException("STAY_CANCELLED",
                    "Impossible d'ajouter une prestation : le séjour est annulé.", 409);
        }
    }

    private StayPrestationView toView(StayPrestation p) {
        BigDecimal qty = p.getQuantity() != null ? p.getQuantity() : BigDecimal.ONE;
        BigDecimal lineTotal = p.getUnitPrice().multiply(qty);
        return new StayPrestationView(
                p.getId(), p.getStayId(), p.getActId(),
                p.getLabel(), p.getUnitPrice(), qty, lineTotal,
                p.getPerformedAt(), p.getCreatedBy());
    }
}
