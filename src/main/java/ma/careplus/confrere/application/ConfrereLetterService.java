package ma.careplus.confrere.application;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.UUID;
import ma.careplus.confrere.infrastructure.web.dto.ConfrereLetterRequest;
import ma.careplus.confrere.infrastructure.web.dto.ConfrereLetterResponse;
import ma.careplus.documents.application.DocumentStorage;
import ma.careplus.documents.domain.DocumentType;
import ma.careplus.documents.domain.PatientDocument;
import ma.careplus.documents.infrastructure.persistence.PatientDocumentRepository;
import ma.careplus.documents.infrastructure.web.dto.PatientDocumentView;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Génère un courrier au confrère pour une consultation donnée et le stocke
 * comme {@code patient_document} de type LETTRE_CONFRERE. QA9-10.
 *
 * <p>Convention cross-module : la consultation est résolue via JdbcTemplate
 * (comme le font ConsentPdfService, StaySummaryPdfService…) pour éviter
 * d'importer le repository clinical depuis le module confrere.
 */
@Service
@Transactional
public class ConfrereLetterService {

    private final ConfrereLetterPdfService pdfService;
    private final DocumentStorage storage;
    private final PatientDocumentRepository documentRepository;
    private final JdbcTemplate jdbc;

    public ConfrereLetterService(ConfrereLetterPdfService pdfService,
                                 DocumentStorage storage,
                                 PatientDocumentRepository documentRepository,
                                 JdbcTemplate jdbc) {
        this.pdfService = pdfService;
        this.storage = storage;
        this.documentRepository = documentRepository;
        this.jdbc = jdbc;
    }

    /**
     * Génère le PDF, stocke le binaire, crée le record patient_document.
     *
     * @param consultationId identifiant de la consultation source
     * @param req            corps de la requête (destinataire + body)
     * @param actorId        identifiant du médecin émetteur (uploaded_by + signature)
     * @return identifiant du document créé
     */
    public ConfrereLetterResponse generate(UUID consultationId,
                                           ConfrereLetterRequest req,
                                           UUID actorId) {
        // Charger patient_id + practitioner_id depuis la consultation (cross-module via JDBC)
        ConsultationRow consultation = fetchConsultation(consultationId);

        // Générer le PDF
        byte[] pdfBytes = pdfService.generate(
                consultation.practitionerId(),
                req.recipientName(),
                req.recipientSpecialty(),
                req.recipientCity(),
                req.body());

        // Stocker le binaire
        UUID docId = UUID.randomUUID();
        String storageKey;
        try {
            storageKey = storage.store(consultation.patientId(), docId, "pdf",
                    new ByteArrayInputStream(pdfBytes));
        } catch (java.io.IOException e) {
            throw new BusinessException("CONFRERE_STORAGE_FAILED",
                    "Échec de l'écriture du PDF sur disque.",
                    HttpStatus.INTERNAL_SERVER_ERROR.value());
        }

        // Titre du document
        String title = "Courrier — Dr " + req.recipientName();

        // Créer le record patient_document
        PatientDocument doc = new PatientDocument();
        doc.setPatientId(consultation.patientId());
        doc.setType(DocumentType.LETTRE_CONFRERE);
        doc.setOriginalFilename(sanitizeFilename(title) + ".pdf");
        doc.setMimeType("application/pdf");
        doc.setSizeBytes(pdfBytes.length);
        doc.setStorageKey(storageKey);
        // Stocker consultationId dans notes (même pattern que consent/templateId)
        doc.setNotes("consultationId=" + consultationId);
        doc.setUploadedBy(actorId);

        // Injecter l'id pré-calculé (même astuce que PatientConsentService)
        try {
            var f = PatientDocument.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(doc, docId);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }

        PatientDocument saved = documentRepository.save(doc);
        return new ConfrereLetterResponse(saved.getId());
    }

    /**
     * Liste les courriers LETTRE_CONFRERE associés à une consultation.
     *
     * <p>patient_document n'a pas de colonne consultation_id, donc on filtre
     * par patient + type + notes contenant le consultationId (même stratégie
     * que le frontend pour afficher la liste par consultation).
     */
    @Transactional(readOnly = true)
    public List<PatientDocumentView> listForConsultation(UUID consultationId) {
        ConsultationRow consultation = fetchConsultation(consultationId);
        return documentRepository
                .findConfrereLettersByPatientAndConsultation(
                        consultation.patientId(),
                        "consultationId=" + consultationId)
                .stream()
                .map(PatientDocumentView::of)
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private record ConsultationRow(UUID patientId, UUID practitionerId) {}

    private ConsultationRow fetchConsultation(UUID consultationId) {
        try {
            ConsultationRow row = jdbc.queryForObject(
                    "SELECT patient_id, practitioner_id FROM clinical_consultation WHERE id = ?",
                    (rs, n) -> new ConsultationRow(
                            rs.getObject("patient_id", UUID.class),
                            rs.getObject("practitioner_id", UUID.class)),
                    consultationId);
            if (row == null) {
                throw new BusinessException("CONSULTATION_NOT_FOUND",
                        "Consultation introuvable.", HttpStatus.NOT_FOUND.value());
            }
            return row;
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new BusinessException("CONSULTATION_NOT_FOUND",
                    "Consultation introuvable.", HttpStatus.NOT_FOUND.value());
        }
    }

    private static String sanitizeFilename(String title) {
        if (title == null) return "courrier-confrere";
        return title.replaceAll("[^a-zA-ZÀ-ÿ0-9 _\\-]", "").trim().replace(' ', '_');
    }
}
