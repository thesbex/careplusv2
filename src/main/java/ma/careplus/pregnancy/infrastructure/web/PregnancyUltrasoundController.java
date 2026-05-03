package ma.careplus.pregnancy.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.pregnancy.application.PregnancyUltrasoundService;
import ma.careplus.pregnancy.domain.PregnancyUltrasound;
import ma.careplus.pregnancy.infrastructure.web.dto.RecordUltrasoundRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.UltrasoundView;
import ma.careplus.pregnancy.infrastructure.web.mapper.PregnancyMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Obstetric ultrasound endpoints — Étape 2.
 *
 * <pre>
 * GET  /api/pregnancies/{pregnancyId}/ultrasounds   — all roles
 * POST /api/pregnancies/{pregnancyId}/ultrasounds   — MEDECIN / ADMIN
 * </pre>
 */
@RestController
@Tag(name = "pregnancy", description = "Module suivi prénatal — échographies obstétricales")
public class PregnancyUltrasoundController {

    private final PregnancyUltrasoundService ultrasoundService;
    private final PregnancyMapper mapper;

    public PregnancyUltrasoundController(PregnancyUltrasoundService ultrasoundService,
                                          PregnancyMapper mapper) {
        this.ultrasoundService = ultrasoundService;
        this.mapper = mapper;
    }

    @GetMapping("/api/pregnancies/{pregnancyId}/ultrasounds")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<UltrasoundView>> list(@PathVariable UUID pregnancyId) {
        List<PregnancyUltrasound> echos = ultrasoundService.listByPregnancy(pregnancyId);
        List<UltrasoundView> views = echos.stream().map(mapper::toUltrasoundView).toList();
        return ResponseEntity.ok(views);
    }

    @PostMapping("/api/pregnancies/{pregnancyId}/ultrasounds")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<UltrasoundView> record(
            @PathVariable UUID pregnancyId,
            @Valid @RequestBody RecordUltrasoundRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        PregnancyUltrasound echo = ultrasoundService.record(pregnancyId, req, actorId);
        UltrasoundView view = mapper.toUltrasoundView(echo);
        return ResponseEntity.created(
                URI.create("/api/pregnancies/" + pregnancyId + "/ultrasounds/" + echo.getId()))
                .body(view);
    }
}
