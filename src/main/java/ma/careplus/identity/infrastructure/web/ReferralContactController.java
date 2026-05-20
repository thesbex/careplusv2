package ma.careplus.identity.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.identity.application.ReferralContactService;
import ma.careplus.identity.domain.ReferralContact;
import ma.careplus.identity.infrastructure.web.dto.ReferralContactRequest;
import ma.careplus.identity.infrastructure.web.dto.ReferralContactView;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * V046 — carnet personnel de confrères du médecin connecté.
 *
 * Toutes les routes sont scopées au caller : impossible de lister, éditer
 * ou supprimer le carnet d'un autre médecin (le service refuse 404).
 * Réservé aux rôles cliniques (MEDECIN, ADMIN). Les rôles administratifs
 * (SECRETAIRE, ASSISTANT) n'ont pas vocation à gérer le carnet personnel
 * d'un médecin — ils peuvent toujours téléphoner depuis la fiche patient
 * via les contacts du dossier.
 */
@RestController
@RequestMapping("/api/me/referrals")
public class ReferralContactController {

    private final ReferralContactService service;

    public ReferralContactController(ReferralContactService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<ReferralContactView> list(Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        return service.listFor(ownerId).stream().map(ReferralContactView::of).toList();
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<ReferralContactView> create(
            @Valid @RequestBody ReferralContactRequest req,
            Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        ReferralContact saved = service.create(
                ownerId, req.fullName(), req.specialty(),
                req.phone(), req.city(), req.notes());
        return ResponseEntity
                .created(URI.create("/api/me/referrals/" + saved.getId()))
                .body(ReferralContactView.of(saved));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ReferralContactView update(
            @PathVariable UUID id,
            @Valid @RequestBody ReferralContactRequest req,
            Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        ReferralContact saved = service.update(
                ownerId, id, req.fullName(), req.specialty(),
                req.phone(), req.city(), req.notes());
        return ReferralContactView.of(saved);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        UUID ownerId = UUID.fromString(auth.getName());
        service.delete(ownerId, id);
        return ResponseEntity.noContent().build();
    }
}
