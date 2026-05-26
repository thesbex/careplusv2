package ma.careplus.consent.application;

import java.io.ByteArrayInputStream;
import java.util.List;
import java.util.UUID;
import ma.careplus.consent.infrastructure.web.dto.GenerateConsentRequest;
import ma.careplus.consent.infrastructure.web.dto.GenerateConsentResponse;
import ma.careplus.documents.application.DocumentService;
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
 * Génère un document de consentement pour un patient et le stocke comme
 * {@code patient_document} de type CONSENTEMENT. QA9-13 — Part B.
 *
 * Convention : on n'utilise pas {@link DocumentService#upload} (qui attend un
 * {@code MultipartFile} multipart). On passe directement par le repository +
 * {@link DocumentStorage} comme le font d'autres services PDF (ex. ordonnance
 * — qui revient directement les bytes au client). Ici on persiste en plus.
 */
@Service
@Transactional
public class PatientConsentService {

    private final ConsentPdfService pdfService;
    private final DocumentStorage storage;
    private final PatientDocumentRepository documentRepository;
    private final JdbcTemplate jdbc;

    public PatientConsentService(ConsentPdfService pdfService,
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
     * @param patientId identifiant du patient
     * @param req       titre + body (déjà édités par le médecin, placeholders non encore substitués)
     * @param actorId   identifiant du médecin qui génère (uploaded_by)
     * @return identifiant du document créé
     */
    public GenerateConsentResponse generate(UUID patientId, GenerateConsentRequest req, UUID actorId) {
        // Vérifier que le patient existe et est actif
        Integer present = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_patient WHERE id = ? AND deleted_at IS NULL",
                Integer.class, patientId);
        if (present == null || present == 0) {
            throw new BusinessException("PATIENT_NOT_FOUND",
                    "Patient introuvable.", HttpStatus.NOT_FOUND.value());
        }

        // Générer le PDF (avec substitution des placeholders)
        byte[] pdfBytes = pdfService.generate(patientId, req.title(), req.body());

        // Stocker le binaire sur disque
        UUID docId = UUID.randomUUID();
        String storageKey;
        try {
            storageKey = storage.store(patientId, docId, "pdf", new ByteArrayInputStream(pdfBytes));
        } catch (java.io.IOException e) {
            throw new BusinessException("CONSENT_STORAGE_FAILED",
                    "Échec de l'écriture du PDF sur disque.",
                    HttpStatus.INTERNAL_SERVER_ERROR.value());
        }

        // Créer le record patient_document
        PatientDocument doc = new PatientDocument();
        doc.setPatientId(patientId);
        doc.setType(DocumentType.CONSENTEMENT);
        doc.setOriginalFilename(sanitizeFilename(req.title()) + ".pdf");
        doc.setMimeType("application/pdf");
        doc.setSizeBytes(pdfBytes.length);
        doc.setStorageKey(storageKey);
        doc.setNotes(req.templateId() != null ? "templateId=" + req.templateId() : null);
        doc.setUploadedBy(actorId);

        // Injecter l'id pré-calculé (même astuce que DocumentService.withId)
        try {
            var f = PatientDocument.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(doc, docId);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }

        PatientDocument saved = documentRepository.save(doc);
        return new GenerateConsentResponse(saved.getId());
    }

    /**
     * Liste les documents CONSENTEMENT d'un patient (pour historique).
     */
    @Transactional(readOnly = true)
    public List<PatientDocumentView> list(UUID patientId) {
        return documentRepository.findConsentsByPatient(patientId)
                .stream()
                .map(PatientDocumentView::of)
                .toList();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String sanitizeFilename(String title) {
        if (title == null) return "consentement";
        return title.replaceAll("[^a-zA-ZÀ-ÿ0-9 _-]", "").trim().replace(' ', '_');
    }
}
