package ma.careplus.pregnancy.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import ma.careplus.pregnancy.application.PregnancyVisitService;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import ma.careplus.pregnancy.infrastructure.web.dto.PregnancyVisitView;
import ma.careplus.pregnancy.infrastructure.web.dto.RecordVisitRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.UpdateVisitRequest;
import ma.careplus.pregnancy.infrastructure.web.mapper.PregnancyMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Obstetric visit endpoints — Étape 2.
 *
 * <pre>
 * GET  /api/pregnancies/{pregnancyId}/visits          — all roles
 * POST /api/pregnancies/{pregnancyId}/visits          — ASSISTANT / MEDECIN / ADMIN
 * PUT  /api/pregnancies/visits/{visitId}              — ASSISTANT / MEDECIN / ADMIN
 * </pre>
 */
@RestController
@Tag(name = "pregnancy", description = "Module suivi prénatal — visites obstétricales")
public class PregnancyVisitController {

    private final PregnancyVisitService visitService;
    private final PregnancyMapper mapper;

    public PregnancyVisitController(PregnancyVisitService visitService, PregnancyMapper mapper) {
        this.visitService = visitService;
        this.mapper = mapper;
    }

    @GetMapping("/api/pregnancies/{pregnancyId}/visits")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<Page<PregnancyVisitView>> list(
            @PathVariable UUID pregnancyId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "recordedAt"));
        Page<PregnancyVisit> visits = visitService.listByPregnancy(pregnancyId, pageable);
        return ResponseEntity.ok(visits.map(mapper::toVisitView));
    }

    @PostMapping("/api/pregnancies/{pregnancyId}/visits")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<PregnancyVisitView> record(
            @PathVariable UUID pregnancyId,
            @Valid @RequestBody RecordVisitRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        PregnancyVisit visit = visitService.record(pregnancyId, req, actorId);
        PregnancyVisitView view = mapper.toVisitView(visit);
        return ResponseEntity.created(
                URI.create("/api/pregnancies/visits/" + visit.getId()))
                .body(view);
    }

    @PutMapping("/api/pregnancies/visits/{visitId}")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<PregnancyVisitView> update(
            @PathVariable UUID visitId,
            @Valid @RequestBody UpdateVisitRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        PregnancyVisit updated = visitService.update(visitId, req, actorId);
        return ResponseEntity.ok(mapper.toVisitView(updated));
    }
}
