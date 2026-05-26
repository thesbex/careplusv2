package ma.careplus.consent.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.consent.infrastructure.web.dto.ConsentTemplateView;
import ma.careplus.consent.infrastructure.web.dto.ConsentTemplateWriteRequest;

/**
 * Service public de gestion des modèles de consentement. QA9-13 — Part A.
 */
public interface ConsentTemplateService {

    /** Liste tous les modèles non supprimés. MEDECIN voit actifs seuls, ADMIN voit tout. */
    List<ConsentTemplateView> list(boolean adminView);

    /** Récupère un modèle par id. */
    ConsentTemplateView get(UUID id);

    /** Crée un nouveau modèle. ADMIN only. */
    ConsentTemplateView create(ConsentTemplateWriteRequest req, UUID createdBy);

    /** Met à jour un modèle existant. ADMIN only. */
    ConsentTemplateView update(UUID id, ConsentTemplateWriteRequest req);

    /** Soft-delete d'un modèle. ADMIN only. */
    void delete(UUID id);
}
