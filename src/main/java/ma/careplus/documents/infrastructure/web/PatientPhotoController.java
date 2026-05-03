package ma.careplus.documents.infrastructure.web;

import java.util.UUID;
import ma.careplus.documents.application.DocumentService;
import ma.careplus.documents.domain.PatientDocument;
import ma.careplus.documents.infrastructure.web.dto.PatientDocumentView;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Endpoints photo patient (QA5-3) :
 *   PUT    /api/patients/{patientId}/photo   (multipart : file)  → remplace la photo courante
 *   DELETE /api/patients/{patientId}/photo                       → retire la photo
 *
 * La lecture du binaire passe par {@code GET /api/documents/{id}/content}
 * (PatientView expose {@code photoDocumentId}). Pas d'endpoint dédié pour
 * éviter de dupliquer la logique de streaming + 410 GONE.
 */
@RestController
public class PatientPhotoController {

    private final DocumentService service;

    public PatientPhotoController(DocumentService service) {
        this.service = service;
    }

    @PutMapping(
            value = "/api/patients/{patientId}/photo",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<PatientDocumentView> upload(
            @PathVariable UUID patientId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        UUID uploadedBy = UUID.fromString(auth.getName());
        PatientDocument saved = service.replacePhoto(patientId, file, uploadedBy);
        return ResponseEntity.ok(PatientDocumentView.of(saved));
    }

    @DeleteMapping("/api/patients/{patientId}/photo")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Void> remove(@PathVariable UUID patientId) {
        service.removePhoto(patientId);
        return ResponseEntity.noContent().build();
    }
}
