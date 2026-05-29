package ma.careplus.clinical.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.domain.SoapTemplate;
import ma.careplus.clinical.infrastructure.persistence.SoapTemplateRepository;
import ma.careplus.clinical.infrastructure.web.dto.SoapTemplateView;
import ma.careplus.clinical.infrastructure.web.dto.SoapTemplateWriteRequest;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Modèles SOAP privés au médecin. Le {@code practitionerId} vient toujours du JWT :
 * un médecin ne peut lire/modifier que ses propres modèles.
 */
@Service
@Transactional
public class SoapTemplateService {

    private final SoapTemplateRepository repo;

    public SoapTemplateService(SoapTemplateRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<SoapTemplateView> list(UUID practitionerId) {
        return repo.findByPractitionerIdAndDeletedAtIsNullOrderByNameAsc(practitionerId)
                .stream().map(SoapTemplateView::of).toList();
    }

    @Transactional(readOnly = true)
    public SoapTemplateView get(UUID id, UUID practitionerId) {
        return SoapTemplateView.of(findOrThrow(id, practitionerId));
    }

    public SoapTemplateView create(UUID practitionerId, SoapTemplateWriteRequest req) {
        SoapTemplate t = new SoapTemplate();
        t.setPractitionerId(practitionerId);
        apply(t, req);
        return SoapTemplateView.of(repo.save(t));
    }

    public SoapTemplateView update(UUID id, UUID practitionerId, SoapTemplateWriteRequest req) {
        SoapTemplate t = findOrThrow(id, practitionerId);
        apply(t, req);
        return SoapTemplateView.of(repo.saveAndFlush(t));
    }

    public void delete(UUID id, UUID practitionerId) {
        SoapTemplate t = findOrThrow(id, practitionerId);
        t.setDeletedAt(OffsetDateTime.now());
        repo.save(t);
    }

    private void apply(SoapTemplate t, SoapTemplateWriteRequest req) {
        t.setName(req.name().trim());
        t.setSubjectif(req.subjectif());
        t.setObjectif(req.objectif());
        t.setAnalyse(req.analyse());
        t.setPlan(req.plan());
    }

    private SoapTemplate findOrThrow(UUID id, UUID practitionerId) {
        return repo.findByIdAndPractitionerIdAndDeletedAtIsNull(id, practitionerId)
                .orElseThrow(() -> new NotFoundException(
                        "SOAP_TEMPLATE_NOT_FOUND", "Modèle de consultation introuvable : " + id));
    }
}
