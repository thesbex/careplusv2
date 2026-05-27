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
    public LetterTemplateView get(UUID id) {
        return LetterTemplateView.of(findOrThrow(id));
    }

    @Override
    public LetterTemplateView create(LetterTemplateWriteRequest req, UUID createdBy) {
        LetterTemplate t = new LetterTemplate();
        t.setTitle(req.title().trim());
        t.setBody(req.body());
        t.setActive(req.active());
        t.setCreatedBy(createdBy);
        return LetterTemplateView.of(repository.save(t));
    }

    @Override
    public LetterTemplateView update(UUID id, LetterTemplateWriteRequest req) {
        LetterTemplate t = findOrThrow(id);
        t.setTitle(req.title().trim());
        t.setBody(req.body());
        t.setActive(req.active());
        return LetterTemplateView.of(repository.saveAndFlush(t));
    }

    @Override
    public void delete(UUID id) {
        LetterTemplate t = findOrThrow(id);
        t.setDeletedAt(OffsetDateTime.now());
        repository.save(t);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private LetterTemplate findOrThrow(UUID id) {
        return repository.findActiveById(id)
                .orElseThrow(() -> new BusinessException(
                        "LETTER_TEMPLATE_NOT_FOUND",
                        "Modèle de courrier introuvable.",
                        HttpStatus.NOT_FOUND.value()));
    }
}
