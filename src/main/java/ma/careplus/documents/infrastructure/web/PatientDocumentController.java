package ma.careplus.documents.infrastructure.web;

import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.documents.application.DocumentService;
import ma.careplus.documents.application.DocumentStorage;
import ma.careplus.documents.domain.DocumentType;
import ma.careplus.documents.domain.PatientDocument;
import ma.careplus.documents.infrastructure.web.dto.PatientDocumentView;
import ma.careplus.shared.error.BusinessException;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Endpoints documents patient (QA2-2) :
 *   POST   /api/patients/{patientId}/documents     (multipart : file, type, notes?)
 *   GET    /api/patients/{patientId}/documents
 *   GET    /api/documents/{id}/content             (stream binaire)
 *   DELETE /api/documents/{id}                     (soft-delete)
 */
@RestController
public class PatientDocumentController {

    private final DocumentService service;
    private final DocumentStorage storage;

    public PatientDocumentController(DocumentService service, DocumentStorage storage) {
        this.service = service;
        this.storage = storage;
    }

    @PostMapping(
            value = "/api/patients/{patientId}/documents",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<PatientDocumentView> upload(
            @PathVariable UUID patientId,
            @RequestParam("file") MultipartFile file,
            @RequestParam("type") String typeRaw,
            @RequestParam(value = "notes", required = false) String notes,
            Authentication auth) {
        DocumentType type;
        try {
            type = DocumentType.valueOf(typeRaw);
        } catch (IllegalArgumentException e) {
            throw new BusinessException("DOCUMENT_TYPE_INVALID",
                    "Type inconnu : " + typeRaw, HttpStatus.BAD_REQUEST.value());
        }
        UUID uploadedBy = UUID.fromString(auth.getName());
        PatientDocument saved = service.upload(patientId, type, notes, file, uploadedBy);
        return ResponseEntity
                .created(URI.create("/api/documents/" + saved.getId()))
                .body(PatientDocumentView.of(saved));
    }

    @GetMapping("/api/patients/{patientId}/documents")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<PatientDocumentView> list(@PathVariable UUID patientId) {
        return service.list(patientId).stream().map(PatientDocumentView::of).toList();
    }

    @GetMapping("/api/documents/{id}/content")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Resource> download(@PathVariable UUID id) {
        PatientDocument doc = service.getActive(id);
        Resource res = storage.loadAsResource(doc.getStorageKey());
        long actualLength;
        try {
            actualLength = res.exists() ? res.contentLength() : -1L;
        } catch (java.io.IOException e) {
            actualLength = -1L;
        }
        // A 0-byte or missing file is an orphan record (storage root reset,
        // tmpdir wipe, etc.). Surface it as 410 GONE so the UI can show
        // a clear "fichier disparu" instead of streaming an empty body
        // and letting the client fail with a generic PDF parse error.
        if (actualLength <= 0) {
            throw new BusinessException("DOCUMENT_FILE_MISSING",
                    "Fichier physique introuvable ou vide. Supprimez puis réimportez le document.",
                    HttpStatus.GONE.value());
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, doc.getMimeType())
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + sanitizeForHeader(doc.getOriginalFilename()) + "\"")
                .header(HttpHeaders.CONTENT_LENGTH, String.valueOf(actualLength))
                .body(res);
    }

    @DeleteMapping("/api/documents/{id}")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.softDelete(id);
        return ResponseEntity.noContent().build();
    }

    private static String sanitizeForHeader(String filename) {
        // Strip CR/LF + double-quote — preserves accents (RFC 6266 fallback path).
        return filename == null ? "document" : filename.replaceAll("[\\r\\n\"]", "_");
    }
}
