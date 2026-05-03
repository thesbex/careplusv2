package ma.careplus.documents.application;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import ma.careplus.catalog.domain.PrescriptionLine;
import ma.careplus.catalog.infrastructure.persistence.PrescriptionLineRepository;
import ma.careplus.documents.domain.DocumentType;
import ma.careplus.documents.domain.PatientDocument;
import ma.careplus.documents.infrastructure.persistence.PatientDocumentRepository;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Logique métier pour les documents patient (QA2-2) :
 *   - Vérifie que le patient existe (active + non soft-delete) avant tout.
 *   - Whitelist MIME stricte : PDF / JPEG / PNG / WebP / HEIC.
 *     La taille est plafonnée par {@code spring.servlet.multipart.max-file-size}.
 *   - Soft-delete : {@code deleted_at} pour le record, suppression
 *     du fichier sur disque (gain d'espace immédiat).
 */
@Service
public class DocumentService {

    private static final Set<String> ALLOWED_MIME = Set.of(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
    );

    /** Photo patient (QA5-3) : image uniquement, pas de PDF. */
    private static final Set<String> ALLOWED_PHOTO_MIME = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
    );

    /** Plafond plus serré pour la photo patient (2 Mo, vs 10 Mo pour les docs). QA5-3. */
    private static final long PHOTO_MAX_BYTES = 2L * 1024 * 1024;

    private final PatientDocumentRepository repository;
    private final DocumentStorage storage;
    private final JdbcTemplate jdbc;
    private final PrescriptionLineRepository prescriptionLineRepository;

    public DocumentService(PatientDocumentRepository repository,
                           DocumentStorage storage,
                           JdbcTemplate jdbc,
                           PrescriptionLineRepository prescriptionLineRepository) {
        this.repository = repository;
        this.storage = storage;
        this.jdbc = jdbc;
        this.prescriptionLineRepository = prescriptionLineRepository;
    }

    @Transactional
    public PatientDocument upload(UUID patientId, DocumentType type, String notes,
                                  MultipartFile file, UUID uploadedBy) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("DOCUMENT_EMPTY",
                    "Fichier vide ou manquant.", HttpStatus.BAD_REQUEST.value());
        }

        String mime = file.getContentType();
        if (mime == null || !ALLOWED_MIME.contains(mime.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("DOCUMENT_MIME_REJECTED",
                    "Format non supporté. Acceptés : PDF, JPEG, PNG, WebP, HEIC.",
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE.value());
        }

        // Patient must exist and not be soft-deleted.
        Integer present = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_patient WHERE id = ? AND deleted_at IS NULL",
                Integer.class, patientId);
        if (present == null || present == 0) {
            throw new BusinessException("PATIENT_NOT_FOUND",
                    "Patient introuvable.", HttpStatus.NOT_FOUND.value());
        }

        UUID docId = UUID.randomUUID();
        String original = file.getOriginalFilename() == null ? "document" : file.getOriginalFilename();
        String ext = extractExtension(original);

        String key;
        try (var in = file.getInputStream()) {
            key = storage.store(patientId, docId, ext, in);
        } catch (IOException e) {
            throw new BusinessException("DOCUMENT_STORAGE_FAILED",
                    "Échec de l'écriture du fichier sur disque.",
                    HttpStatus.INTERNAL_SERVER_ERROR.value());
        }

        PatientDocument doc = new PatientDocument();
        doc.setPatientId(patientId);
        doc.setType(type);
        doc.setOriginalFilename(original);
        doc.setMimeType(mime);
        doc.setSizeBytes(file.getSize());
        doc.setStorageKey(key);
        doc.setNotes(notes);
        doc.setUploadedBy(uploadedBy);
        // setting id explicitly so it matches the storage_key — easier debugging
        // and aligns with @PrePersist's no-op when id already present.
        var withId = withId(doc, docId);
        return repository.save(withId);
    }

    public List<PatientDocument> list(UUID patientId) {
        return repository.findActiveByPatient(patientId);
    }

    public PatientDocument getActive(UUID id) {
        PatientDocument doc = repository.findActive(id).orElseThrow(() -> new BusinessException(
                "DOCUMENT_NOT_FOUND", "Document introuvable.", HttpStatus.NOT_FOUND.value()));
        // Refuse to surface a document whose parent patient was archived/soft-deleted.
        // Without this guard, a /documents/{id}/content URL keeps streaming bytes
        // even after the patient record was removed from the active dataset.
        Integer patientActive = jdbc.queryForObject(
                "SELECT COUNT(*) FROM patient_patient WHERE id = ? AND deleted_at IS NULL",
                Integer.class, doc.getPatientId());
        if (patientActive == null || patientActive == 0) {
            throw new BusinessException(
                    "DOCUMENT_NOT_FOUND", "Document introuvable.", HttpStatus.NOT_FOUND.value());
        }
        return doc;
    }

    /**
     * Remplace la photo courante d'un patient (QA5-3). Soft-delete l'ancienne
     * photo si présente, stocke la nouvelle, met à jour la dénormalisation
     * {@code patient_patient.photo_document_id} pour permettre un rendu
     * rapide de la liste patients sans sous-requête.
     */
    @Transactional
    public PatientDocument replacePhoto(UUID patientId, MultipartFile file, UUID uploadedBy) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("DOCUMENT_EMPTY",
                    "Photo vide ou manquante.", HttpStatus.BAD_REQUEST.value());
        }
        String mime = file.getContentType();
        if (mime == null || !ALLOWED_PHOTO_MIME.contains(mime.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("DOCUMENT_MIME_REJECTED",
                    "Format non supporté pour une photo. Acceptés : JPEG, PNG, WebP, HEIC.",
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE.value());
        }
        if (file.getSize() > PHOTO_MAX_BYTES) {
            throw new BusinessException("DOCUMENT_TOO_LARGE",
                    "Photo trop volumineuse (max 2 Mo).",
                    HttpStatus.PAYLOAD_TOO_LARGE.value());
        }

        // Soft-delete des anciennes photos avant d'uploader la nouvelle.
        for (PatientDocument old : repository.findCurrentPhotos(patientId)) {
            old.setDeletedAt(Instant.now());
            repository.save(old);
            try {
                storage.delete(old.getStorageKey());
            } catch (IOException e) {
                // best effort
            }
        }

        PatientDocument saved = upload(patientId, DocumentType.PHOTO, null, file, uploadedBy);

        // Force le flush JPA AVANT la mise à jour JDBC — sinon le FK
        // patient_patient.photo_document_id → patient_document.id échoue,
        // l'INSERT de la nouvelle photo n'étant encore qu'en persistence
        // context. Reproduit en QA5 le 2026-05-01 (PUT /photo → 500).
        repository.flush();

        // Mise à jour de la dénormalisation côté patient_patient.
        jdbc.update(
                "UPDATE patient_patient SET photo_document_id = ?, updated_at = now() WHERE id = ?",
                saved.getId(), patientId);

        return saved;
    }

    /**
     * Attache un résultat (PDF / image) à une ligne de prescription LAB ou
     * IMAGING (V015). La ligne doit exister, doit pointer sur un lab_test_id
     * ou imaging_exam_id (jamais sur une ligne médicament), et le patient
     * de la prescription doit être actif.
     *
     * Idempotent côté binaire : si la ligne avait déjà un résultat, l'ancien
     * est soft-deleté avant d'attacher le nouveau (même pattern que la photo
     * patient — voir replacePhoto).
     */
    @Transactional
    public PatientDocument attachResult(UUID lineId, MultipartFile file, UUID uploadedBy) {
        PrescriptionLine line = prescriptionLineRepository.findById(lineId)
                .orElseThrow(() -> new BusinessException("PRESCRIPTION_LINE_NOT_FOUND",
                        "Ligne de prescription introuvable.", HttpStatus.NOT_FOUND.value()));

        if (line.getLabTestId() == null && line.getImagingExamId() == null) {
            throw new BusinessException("RESULT_NOT_APPLICABLE",
                    "Un résultat ne peut être attaché qu'à une ligne d'analyse ou d'imagerie.",
                    HttpStatus.BAD_REQUEST.value());
        }

        UUID patientId = jdbc.queryForObject(
                "SELECT patient_id FROM clinical_prescription WHERE id = ?",
                UUID.class, line.getPrescriptionId());

        // Soft-delete de l'ancien résultat si présent.
        if (line.getResultDocumentId() != null) {
            repository.findActiveResult(line.getResultDocumentId()).ifPresent(old -> {
                old.setDeletedAt(Instant.now());
                repository.save(old);
                try { storage.delete(old.getStorageKey()); }
                catch (IOException e) { /* best effort */ }
            });
        }

        PatientDocument saved = upload(patientId, DocumentType.RESULTAT, null, file, uploadedBy);

        // Même piège que QA5-3 : flush JPA AVANT le UPDATE JDBC, sinon le FK
        // result_document_id échoue (la nouvelle PHOTO/RESULTAT n'est pas
        // encore visible côté DB).
        repository.flush();

        jdbc.update(
                "UPDATE clinical_prescription_line SET result_document_id = ?, updated_at = now() WHERE id = ?",
                saved.getId(), lineId);

        return saved;
    }

    @Transactional
    public void detachResult(UUID lineId) {
        PrescriptionLine line = prescriptionLineRepository.findById(lineId)
                .orElseThrow(() -> new BusinessException("PRESCRIPTION_LINE_NOT_FOUND",
                        "Ligne de prescription introuvable.", HttpStatus.NOT_FOUND.value()));
        if (line.getResultDocumentId() == null) return;
        repository.findActiveResult(line.getResultDocumentId()).ifPresent(old -> {
            old.setDeletedAt(Instant.now());
            repository.save(old);
            try { storage.delete(old.getStorageKey()); }
            catch (IOException e) { /* best effort */ }
        });
        jdbc.update(
                "UPDATE clinical_prescription_line SET result_document_id = NULL, updated_at = now() WHERE id = ?",
                lineId);
    }

    /**
     * Supprime la photo courante d'un patient (soft-delete + remet à NULL la
     * dénormalisation). QA5-3.
     */
    @Transactional
    public void removePhoto(UUID patientId) {
        for (PatientDocument old : repository.findCurrentPhotos(patientId)) {
            old.setDeletedAt(Instant.now());
            repository.save(old);
            try {
                storage.delete(old.getStorageKey());
            } catch (IOException e) {
                // best effort
            }
        }
        jdbc.update(
                "UPDATE patient_patient SET photo_document_id = NULL, updated_at = now() WHERE id = ?",
                patientId);
    }

    @Transactional
    public void softDelete(UUID id) {
        PatientDocument doc = getActive(id);
        doc.setDeletedAt(Instant.now());
        repository.save(doc);
        try {
            storage.delete(doc.getStorageKey());
        } catch (IOException e) {
            // Don't fail the call — record is already flagged. Surface in logs only.
        }
    }

    private static PatientDocument withId(PatientDocument d, UUID id) {
        // Reflection-free: the entity has setters except for id. Use @PrePersist
        // by NOT setting id and trusting the random one matches via parameter.
        // Simpler path: re-route through a small private setter via reflection
        // would be overkill — instead, store in a fresh entity with id pre-assigned.
        try {
            var f = PatientDocument.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(d, id);
            return d;
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) return "";
        return filename.substring(dot + 1);
    }
}
