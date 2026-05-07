package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import ma.careplus.identity.application.PractitionerService;
import ma.careplus.identity.infrastructure.web.dto.PractitionerView;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only listing of the active practitioners (MEDECIN role + enabled).
 *
 * <p>Open to every authenticated role — every screen with a practitioner
 * picker (agenda, paramètres, ordonnance signataire) needs this data,
 * regardless of whether the caller is a SECRETAIRE choosing whose agenda
 * to view, an ADMIN provisioning assignments, or a MEDECIN sending a
 * patient to a colleague.
 */
@RestController
@RequestMapping("/api/practitioners")
@Tag(name = "identity", description = "Practitioner directory")
public class PractitionerController {

    private final PractitionerService practitionerService;

    public PractitionerController(PractitionerService practitionerService) {
        this.practitionerService = practitionerService;
    }

    @GetMapping
    @Operation(summary = "List active practitioners ordered by name")
    @PreAuthorize("isAuthenticated()")
    public List<PractitionerView> list() {
        return practitionerService.listActivePractitioners();
    }
}
