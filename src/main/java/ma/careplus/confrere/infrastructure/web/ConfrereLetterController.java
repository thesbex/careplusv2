package ma.careplus.confrere.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import ma.careplus.confrere.application.ConfrereLetterService;
import ma.careplus.confrere.infrastructure.web.dto.ConfrereLetterRequest;
import ma.careplus.confrere.infrastructure.web.dto.ConfrereLetterResponse;
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
 * Génération et liste des courriers au confrère liés à une consultation.
 *
 * <pre>
 *   POST /api/consultations/{consultationId}/confrere-letter   MEDECIN+ADMIN
 *   GET  /api/consultations/{consultationId}/confrere-letters  MEDECIN+ADMIN
 * </pre>
 *
 * Le PDF généré est ensuite récupérable via GET /api/documents/{documentId}/content.
 * QA9-10.
 */
@RestController
@RequestMapping("/api/consultations/{consultationId}")
@Tag(name = "Courrier Confrère", description = "Génération de courriers professionnels au confrère.")
public class ConfrereLetterController {

    private final ConfrereLetterService service;

    public ConfrereLetterController(ConfrereLetterService service) {
        this.service = service;
    }

    @PostMapping("/confrere-letter")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<ConfrereLetterResponse> generate(
            @PathVariable UUID consultationId,
            @Valid @RequestBody ConfrereLetterRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        ConfrereLetterResponse response = service.generate(consultationId, req, actorId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/confrere-letters")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<PatientDocumentView> list(@PathVariable UUID consultationId) {
        return service.listForConsultation(consultationId);
    }
}
