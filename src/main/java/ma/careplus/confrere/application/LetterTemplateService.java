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

    /** Récupère un modèle par id. */
    LetterTemplateView get(UUID id);

    /** Crée un nouveau modèle. ADMIN only. */
    LetterTemplateView create(LetterTemplateWriteRequest req, UUID createdBy);

    /** Met à jour un modèle existant. ADMIN only. */
    LetterTemplateView update(UUID id, LetterTemplateWriteRequest req);

    /** Soft-delete d'un modèle. ADMIN only. */
    void delete(UUID id);
}
