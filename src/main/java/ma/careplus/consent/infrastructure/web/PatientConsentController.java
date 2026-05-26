package ma.careplus.consent.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import ma.careplus.consent.application.PatientConsentService;
import ma.careplus.consent.infrastructure.web.dto.GenerateConsentRequest;
import ma.careplus.consent.infrastructure.web.dto.GenerateConsentResponse;
import ma.careplus.documents.infrastructure.web.dto.PatientDocumentView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Génération et liste des consentements d'un patient.
 * <pre>
 *   POST /api/patients/{patientId}/consents   MEDECIN+ADMIN → génère PDF + crée patient_document CONSENTEMENT
 *   GET  /api/patients/{patientId}/consents   MEDECIN+ADMIN → liste les CONSENTEMENT du patient
 * </pre>
 * Le PDF généré est ensuite récupérable via GET /api/documents/{documentId}/content.
 * QA9-13.
 */
@RestController
@RequestMapping("/api/patients/{patientId}/consents")
@Tag(name = "Consentement", description = "Génération de documents de consentement patient.")
public class PatientConsentController {

    private final PatientConsentService service;

    public PatientConsentController(PatientConsentService service) {
        this.service = service;
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<GenerateConsentResponse> generate(
            @PathVariable UUID patientId,
            @Valid @RequestBody GenerateConsentRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        GenerateConsentResponse response = service.generate(patientId, req, actorId);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<PatientDocumentView> list(@PathVariable UUID patientId) {
        return service.list(patientId);
    }
}
