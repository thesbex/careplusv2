package ma.careplus.documents.infrastructure.web;

import jakarta.validation.Valid;
import java.util.UUID;
import ma.careplus.documents.application.DocumentService;
import ma.careplus.documents.domain.PatientDocument;
import ma.careplus.documents.infrastructure.web.dto.PatientDocumentView;
import ma.careplus.documents.infrastructure.web.dto.SetResultTextRequest;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Endpoints résultat-de-prescription (V015) :
 *   PUT    /api/prescriptions/lines/{lineId}/result   (multipart : file)
 *   DELETE /api/prescriptions/lines/{lineId}/result
 *
 * Le binaire se télécharge ensuite via {@code GET /api/documents/{id}/content}
 * en utilisant l'`id` exposé par {@code PrescriptionLineResponse.resultDocumentId}.
 * Pas d'endpoint dédié — on réutilise la logique de streaming + 410 GONE
 * de PatientDocumentController.
 */
@RestController
public class PrescriptionResultController {

    private final DocumentService service;

    public PrescriptionResultController(DocumentService service) {
        this.service = service;
    }

    @PutMapping(
            value = "/api/prescriptions/lines/{lineId}/result",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    // V038 — LAB et RADIO doivent pouvoir uploader leurs propres résultats
    // depuis la queue interne. Les autres rôles (SECRETAIRE/ASSISTANT) gardent
    // l'accès pour les workflows externes (réception d'un résultat papier).
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN','LAB','RADIO')")
    public ResponseEntity<PatientDocumentView> upload(
            @PathVariable UUID lineId,
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        UUID uploadedBy = UUID.fromString(auth.getName());
        PatientDocument saved = service.attachResult(lineId, file, uploadedBy);
        return ResponseEntity.ok(PatientDocumentView.of(saved));
    }

    @DeleteMapping("/api/prescriptions/lines/{lineId}/result")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Void> remove(@PathVariable UUID lineId) {
        service.detachResult(lineId);
        return ResponseEntity.noContent().build();
    }

    /**
     * V045 — saisie texte / chiffrée du résultat, en parallèle du PDF.
     * Body JSON {@code { "text": "..." }} ; texte vide ou {@code null} efface
     * la valeur. Authorisé pour les rôles qui peuvent déjà uploader le PDF.
     */
    @PutMapping(
            value = "/api/prescriptions/lines/{lineId}/result-text",
            consumes = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN','LAB','RADIO')")
    public ResponseEntity<Void> setResultText(
            @PathVariable UUID lineId,
            @Valid @RequestBody SetResultTextRequest req) {
        service.setResultText(lineId, req == null ? null : req.text());
        return ResponseEntity.noContent().build();
    }
}
