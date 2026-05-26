package ma.careplus.hospitalization.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.infrastructure.web.dto.StayPrestationRequests.AddPrestationRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayPrestationView;

/**
 * Gestion des prestations de séjour : actes/services additionnels facturés en
 * sus du prix de journée (consultation, oxygène, repas, etc.).
 */
public interface StayPrestationService {

    /**
     * Ajoute une prestation au séjour. Le séjour doit exister (pas nécessairement EN_COURS —
     * on peut saisir une prestation sur un séjour SORTI avant facturation).
     * Rejeté si le séjour est FACTURE ou ANNULE.
     */
    StayPrestationView add(UUID stayId, AddPrestationRequest req, UUID actorId);

    /** Liste les prestations d'un séjour, par ordre chronologique. */
    List<StayPrestationView> list(UUID stayId);

    /**
     * Supprime une prestation. Rejeté (409 STAY_ALREADY_INVOICED) si le séjour est déjà
     * en statut FACTURE. Sinon suppression physique.
     */
    void delete(UUID stayId, UUID prestationId);
}
