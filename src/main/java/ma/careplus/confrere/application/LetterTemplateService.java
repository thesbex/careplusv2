package ma.careplus.confrere.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.confrere.infrastructure.web.dto.LetterTemplateView;
import ma.careplus.confrere.infrastructure.web.dto.LetterTemplateWriteRequest;

/**
 * Service public de gestion des modèles de courrier confrère.
 */
public interface LetterTemplateService {

    /** Liste tous les modèles non supprimés. MEDECIN voit actifs seuls, ADMIN voit tout. */
    List<LetterTemplateView> list(boolean adminView);

    /**
     * V065 — Liste des modèles visibles pour un médecin spécifique :
     * les modèles partagés (owner_user_id NULL) + les modèles privés appartenant
     * à ce médecin. Utilisé par le dialog ConfrereLetter pour ne montrer au
     * médecin que ce qui le concerne (vs la liste cabinet-wide).
     */
    List<LetterTemplateView> listVisibleForUser(UUID userId);

    /** Récupère un modèle par id. */
    LetterTemplateView get(UUID id);

    /**
     * Crée un modèle. ADMIN : portée libre (cabinet-wide ou privé d'un médecin).
     * MEDECIN : forcé en modèle privé (owner = lui), la portée demandée est ignorée.
     */
    LetterTemplateView create(LetterTemplateWriteRequest req, UUID actorId, boolean isAdmin);

    /**
     * Met à jour un modèle. MEDECIN ne peut éditer que SES propres modèles
     * (owner = lui) — sinon 403 ; il ne peut pas réassigner la portée.
     */
    LetterTemplateView update(UUID id, LetterTemplateWriteRequest req, UUID actorId, boolean isAdmin);

    /** Soft-delete. MEDECIN limité à ses propres modèles (sinon 403). */
    void delete(UUID id, UUID actorId, boolean isAdmin);
}
