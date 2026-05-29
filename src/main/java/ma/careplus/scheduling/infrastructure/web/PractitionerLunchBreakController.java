package ma.careplus.scheduling.infrastructure.web;

import jakarta.validation.Valid;
import java.time.LocalTime;
import java.util.UUID;
import ma.careplus.scheduling.application.SchedulingService;
import ma.careplus.scheduling.infrastructure.web.dto.LunchBreakRequest;
import ma.careplus.scheduling.infrastructure.web.dto.LunchBreakView;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pause déjeuner par médecin (V067).
 * <pre>
 *   GET    /api/practitioners/{id}/lunch-break   tout le personnel (lecture agenda/prise-RDV)
 *   PUT    /api/practitioners/{id}/lunch-break   MEDECIN (soi) + ADMIN
 *   DELETE /api/practitioners/{id}/lunch-break   MEDECIN (soi) + ADMIN
 * </pre>
 */
@RestController
@RequestMapping("/api/practitioners/{practitionerId}/lunch-break")
public class PractitionerLunchBreakController {

    private final SchedulingService service;

    public PractitionerLunchBreakController(SchedulingService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<LunchBreakView> get(@PathVariable UUID practitionerId) {
        return service.getLunchBreak(practitionerId)
                .map(lb -> ResponseEntity.ok(
                        new LunchBreakView(lb.getStartTime().toString(), lb.getEndTime().toString())))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public LunchBreakView set(@PathVariable UUID practitionerId,
                              @Valid @RequestBody LunchBreakRequest req,
                              Authentication auth) {
        requireSelfOrAdmin(practitionerId, auth);
        var lb = service.setLunchBreak(practitionerId, parse(req.startTime()), parse(req.endTime()));
        return new LunchBreakView(lb.getStartTime().toString(), lb.getEndTime().toString());
    }

    @DeleteMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> clear(@PathVariable UUID practitionerId, Authentication auth) {
        requireSelfOrAdmin(practitionerId, auth);
        service.clearLunchBreak(practitionerId);
        return ResponseEntity.noContent().build();
    }

    private static LocalTime parse(String hhmm) {
        try {
            return LocalTime.parse(hhmm);
        } catch (Exception e) {
            throw new BusinessException("LUNCH_INVALID", "Heure invalide (format HH:mm attendu).",
                    HttpStatus.BAD_REQUEST.value());
        }
    }

    private static void requireSelfOrAdmin(UUID practitionerId, Authentication auth) {
        boolean admin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        if (!admin && !practitionerId.equals(UUID.fromString(auth.getName()))) {
            throw new BusinessException("LUNCH_FORBIDDEN",
                    "Vous ne pouvez modifier que votre propre pause déjeuner.",
                    HttpStatus.FORBIDDEN.value());
        }
    }
}
