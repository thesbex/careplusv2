package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import ma.careplus.identity.application.AccessScopeService;
import ma.careplus.identity.application.PractitionerService;
import ma.careplus.identity.infrastructure.web.dto.PractitionerView;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
    private final AccessScopeService accessScopeService;

    public PractitionerController(PractitionerService practitionerService,
                                  AccessScopeService accessScopeService) {
        this.practitionerService = practitionerService;
        this.accessScopeService = accessScopeService;
    }

    @GetMapping
    @Operation(summary = "List active practitioners ordered by name")
    @PreAuthorize("isAuthenticated()")
    public List<PractitionerView> list(Authentication auth) {
        // V032 — when strict isolation is on, the picker is reduced to the
        // practitioners the caller is allowed to act on (MEDECIN → self,
        // SECRETAIRE/ASSISTANT → assignments). Empty Optional = full access.
        List<PractitionerView> all = practitionerService.listActivePractitioners();
        Optional<Set<UUID>> scope = accessScopeService.allowedPractitioners(auth);
        if (scope.isEmpty()) return all;
        Set<UUID> allowed = scope.get();
        return all.stream().filter(p -> allowed.contains(p.id())).toList();
    }
}
