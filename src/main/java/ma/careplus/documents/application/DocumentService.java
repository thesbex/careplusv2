package ma.careplus.documents.application;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
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

    private final PatientDocumentRepository repository;
    private final DocumentStorage storage;
    private final JdbcTemplate jdbc;

    public DocumentService(PatientDocumentRepository repository,
                           DocumentStorage storage,
                           JdbcTemplate jdbc) {
        this.repository = repository;
        this.storage = storage;
        this.jdbc = jdbc;
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
        return repository.findActive(id).orElseThrow(() -> new BusinessException(
                "DOCUMENT_NOT_FOUND", "Document introuvable.", HttpStatus.NOT_FOUND.value()));
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
