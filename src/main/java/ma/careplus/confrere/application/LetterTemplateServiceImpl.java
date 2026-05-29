package ma.careplus.confrere.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.confrere.domain.LetterTemplate;
import ma.careplus.confrere.infrastructure.persistence.LetterTemplateRepository;
import ma.careplus.confrere.infrastructure.web.dto.LetterTemplateView;
import ma.careplus.confrere.infrastructure.web.dto.LetterTemplateWriteRequest;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implémentation du service des modèles de courrier confrère.
 */
@Service
@Transactional
public class LetterTemplateServiceImpl implements LetterTemplateService {

    private final LetterTemplateRepository repository;

    public LetterTemplateServiceImpl(LetterTemplateRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LetterTemplateView> list(boolean adminView) {
        List<LetterTemplate> templates = adminView
                ? repository.findAllActive()
                : repository.findActiveOnly();
        return templates.stream().map(LetterTemplateView::of).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<LetterTemplateView> listVisibleForUser(UUID userId) {
        return repository.findVisibleForUser(userId).stream()
                .map(LetterTemplateView::of)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LetterTemplateView get(UUID id) {
        return LetterTemplateView.of(findOrThrow(id));
    }

    @Override
    public LetterTemplateView create(LetterTemplateWriteRequest req, UUID actorId, boolean isAdmin) {
        LetterTemplate t = new LetterTemplate();
        t.setTitle(req.title().trim());
        t.setBody(req.body());
        t.setActive(req.active());
        t.setCreatedBy(actorId);
        // ADMIN choisit la portée (null = cabinet-wide) ; MEDECIN forcé sur son propre modèle privé.
        t.setOwnerUserId(isAdmin ? req.ownerUserId() : actorId);
        return LetterTemplateView.of(repository.save(t));
    }

    @Override
    public LetterTemplateView update(UUID id, LetterTemplateWriteRequest req, UUID actorId, boolean isAdmin) {
        LetterTemplate t = findOrThrow(id);
        requireOwnershipIfMedecin(t, actorId, isAdmin);
        t.setTitle(req.title().trim());
        t.setBody(req.body());
        t.setActive(req.active());
        // ADMIN peut réassigner la portée ; MEDECIN reste propriétaire de son modèle.
        t.setOwnerUserId(isAdmin ? req.ownerUserId() : actorId);
        return LetterTemplateView.of(repository.saveAndFlush(t));
    }

    @Override
    public void delete(UUID id, UUID actorId, boolean isAdmin) {
        LetterTemplate t = findOrThrow(id);
        requireOwnershipIfMedecin(t, actorId, isAdmin);
        t.setDeletedAt(OffsetDateTime.now());
        repository.save(t);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /** Un MEDECIN ne peut gérer que ses propres modèles privés (owner = lui). */
    private void requireOwnershipIfMedecin(LetterTemplate t, UUID actorId, boolean isAdmin) {
        if (isAdmin) return;
        if (t.getOwnerUserId() == null || !t.getOwnerUserId().equals(actorId)) {
            throw new BusinessException(
                    "LETTER_TEMPLATE_FORBIDDEN",
                    "Vous ne pouvez gérer que vos propres modèles de courrier.",
                    HttpStatus.FORBIDDEN.value());
        }
    }

    private LetterTemplate findOrThrow(UUID id) {
        return repository.findActiveById(id)
                .orElseThrow(() -> new BusinessException(
                        "LETTER_TEMPLATE_NOT_FOUND",
                        "Modèle de courrier introuvable.",
                        HttpStatus.NOT_FOUND.value()));
    }
}
