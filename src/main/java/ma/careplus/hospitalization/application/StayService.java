package ma.careplus.hospitalization.application;

import java.util.List;
import java.util.UUID;
import org.springframework.security.core.Authentication;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayQueueEntry;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.AdmitRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.DischargeRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.TransferRequest;

/**
 * Cycle de vie d'un séjour hospitalier (Slice B+D) :
 * admission → (transferts de lit) → sortie → facturation.
 */
public interface StayService {

    /** Admet un patient : crée le séjour EN_COURS + l'affecte au lit choisi. */
    StayDetailView admit(AdmitRequest req, UUID actorId);

    /** Transfère le séjour vers un autre lit (ferme l'affectation courante, en ouvre une). */
    StayDetailView transfer(UUID stayId, TransferRequest req, UUID actorId);

    /** Sortie médicale : EN_COURS → SORTI, libère le lit, enregistre le compte-rendu. */
    StayDetailView discharge(UUID stayId, DischargeRequest req, UUID actorId);

    /** Annule une admission (EN_COURS → ANNULE), libère le lit. */
    void cancel(UUID stayId, UUID actorId);

    /** Worklist des patients hospitalisés (séjours EN_COURS), filtrée par cloisonnement. */
    List<StayQueueEntry> listActive(Authentication auth);

    /**
     * Liste des séjours par statuts (historique : SORTI/FACTURE/ANNULE, ou tous),
     * filtrée par cloisonnement comme la worklist. Permet de revenir sur un séjour clôturé.
     */
    List<StayQueueEntry> listByStatuses(java.util.Set<String> statuses, Authentication auth);

    /** Nombre de séjours EN_COURS (badge sidebar). */
    long countActive();

    /** Détail d'un séjour + historique ADT + aperçu de facturation. */
    StayDetailView get(UUID stayId);

    /** Tous les séjours d'un patient (onglet dossier), plus récent en premier. */
    List<StayDetailView> listForPatient(UUID patientId);

    /**
     * Génère la facture de séjour (hébergement nuits × prix de journée par
     * affectation), via le module billing. SORTI → FACTURE. Retourne l'id facture.
     */
    UUID generateInvoice(UUID stayId, UUID actorId);
}
