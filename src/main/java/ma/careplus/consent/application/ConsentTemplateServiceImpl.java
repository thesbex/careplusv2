package ma.careplus.consent.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.consent.domain.ConsentTemplate;
import ma.careplus.consent.infrastructure.persistence.ConsentTemplateRepository;
import ma.careplus.consent.infrastructure.web.dto.ConsentTemplateView;
import ma.careplus.consent.infrastructure.web.dto.ConsentTemplateWriteRequest;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implémentation du service des modèles de consentement. QA9-13.
 */
@Service
@Transactional
public class ConsentTemplateServiceImpl implements ConsentTemplateService {

    private final ConsentTemplateRepository repository;

    public ConsentTemplateServiceImpl(ConsentTemplateRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ConsentTemplateView> list(boolean adminView) {
        List<ConsentTemplate> templates = adminView
                ? repository.findAllActive()
                : repository.findActiveOnly();
        return templates.stream().map(ConsentTemplateView::of).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ConsentTemplateView get(UUID id) {
        return ConsentTemplateView.of(findOrThrow(id));
    }

    @Override
    public ConsentTemplateView create(ConsentTemplateWriteRequest req, UUID createdBy) {
        ConsentTemplate t = new ConsentTemplate();
        t.setType(req.type());
        t.setTitle(req.title().trim());
        t.setBody(req.body());
        t.setActive(req.active());
        t.setCreatedBy(createdBy);
        return ConsentTemplateView.of(repository.save(t));
    }

    @Override
    public ConsentTemplateView update(UUID id, ConsentTemplateWriteRequest req) {
        ConsentTemplate t = findOrThrow(id);
        t.setType(req.type());
        t.setTitle(req.title().trim());
        t.setBody(req.body());
        t.setActive(req.active());
        return ConsentTemplateView.of(repository.saveAndFlush(t));
    }

    @Override
    public void delete(UUID id) {
        ConsentTemplate t = findOrThrow(id);
        t.setDeletedAt(OffsetDateTime.now());
        repository.save(t);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private ConsentTemplate findOrThrow(UUID id) {
        return repository.findActiveById(id)
                .orElseThrow(() -> new BusinessException(
                        "CONSENT_TEMPLATE_NOT_FOUND",
                        "Modèle de consentement introuvable.",
                        HttpStatus.NOT_FOUND.value()));
    }
}
