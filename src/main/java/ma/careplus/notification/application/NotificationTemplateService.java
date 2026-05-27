package ma.careplus.notification.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.notification.domain.NotificationTemplate;
import ma.careplus.notification.infrastructure.persistence.NotificationTemplateRepository;
import ma.careplus.notification.infrastructure.web.dto.NotificationTemplateView;
import ma.careplus.notification.infrastructure.web.dto.NotificationTemplateWriteRequest;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** CRUD des modèles de notification (ADMIN). */
@Service
@Transactional
public class NotificationTemplateService {

    private final NotificationTemplateRepository repository;

    public NotificationTemplateService(NotificationTemplateRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<NotificationTemplateView> list() {
        return repository.findAllManaged().stream().map(NotificationTemplateView::of).toList();
    }

    @Transactional(readOnly = true)
    public NotificationTemplateView get(UUID id) {
        return NotificationTemplateView.of(findOrThrow(id));
    }

    public NotificationTemplateView create(NotificationTemplateWriteRequest req, UUID createdBy) {
        NotificationTemplate t = new NotificationTemplate();
        apply(t, req);
        t.setCreatedBy(createdBy);
        return NotificationTemplateView.of(repository.save(t));
    }

    public NotificationTemplateView update(UUID id, NotificationTemplateWriteRequest req) {
        NotificationTemplate t = findOrThrow(id);
        apply(t, req);
        return NotificationTemplateView.of(repository.saveAndFlush(t));
    }

    public void delete(UUID id) {
        NotificationTemplate t = findOrThrow(id);
        t.setDeletedAt(OffsetDateTime.now());
        repository.save(t);
    }

    private void apply(NotificationTemplate t, NotificationTemplateWriteRequest req) {
        t.setEventKey(req.eventKey());
        t.setChannel(req.channel());
        t.setSubject(req.subject() == null || req.subject().isBlank() ? null : req.subject().trim());
        t.setBody(req.body());
        t.setWhatsappTemplateName(
                req.whatsappTemplateName() == null || req.whatsappTemplateName().isBlank()
                        ? null : req.whatsappTemplateName().trim());
        t.setActive(req.active());
    }

    private NotificationTemplate findOrThrow(UUID id) {
        return repository.findActiveById(id)
                .orElseThrow(() -> new BusinessException(
                        "NOTIFICATION_TEMPLATE_NOT_FOUND",
                        "Modèle de notification introuvable.",
                        HttpStatus.NOT_FOUND.value()));
    }
}
