package ma.careplus.pregnancy.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import ma.careplus.pregnancy.application.PregnancyService;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyOutcome;
import ma.careplus.pregnancy.domain.PregnancyVisitPlan;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.pregnancy.infrastructure.web.dto.ClosePregnancyRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.CreateChildRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.DeclarePregnancyRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.PregnancyView;
import ma.careplus.pregnancy.infrastructure.web.dto.PregnancyVisitPlanUpdateRequest;
import ma.careplus.pregnancy.infrastructure.web.dto.PregnancyVisitPlanView;
import ma.careplus.pregnancy.infrastructure.web.dto.UpdatePregnancyRequest;
import ma.careplus.pregnancy.infrastructure.web.mapper.PregnancyMapper;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Pregnancy module REST endpoints — Étape 1.
 *
 * <p>Patient-scoped:
 * GET  /api/patients/{patientId}/pregnancies           — all roles
 * GET  /api/patients/{patientId}/pregnancies/current   — all roles
 * POST /api/patients/{patientId}/pregnancies           — MEDECIN/ADMIN
 *
 * <p>Pregnancy-scoped:
 * PUT  /api/pregnancies/{id}               — MEDECIN/ADMIN
 * POST /api/pregnancies/{id}/close         — MEDECIN/ADMIN
 * POST /api/pregnancies/{id}/create-child  — MEDECIN/ADMIN
 * GET  /api/pregnancies/{id}/plan          — all roles
 * PUT  /api/pregnancies/{id}/plan/{planId} — MEDECIN/ADMIN
 */
@RestController
@Tag(name = "pregnancy", description = "Module suivi prénatal — grossesse + plan de visites")
public class PregnancyController {

    private static final Set<PregnancyOutcome> LIVE_BIRTH_OUTCOMES =
            Set.of(PregnancyOutcome.ACCOUCHEMENT_VIVANT, PregnancyOutcome.MORT_NEE);

    private final PregnancyService pregnancyService;
    private final PregnancyRepository pregnancyRepo;
    private final PregnancyMapper mapper;

    public PregnancyController(PregnancyService pregnancyService,
                                PregnancyRepository pregnancyRepo,
                                PregnancyMapper mapper) {
        this.pregnancyService = pregnancyService;
        this.pregnancyRepo = pregnancyRepo;
        this.mapper = mapper;
    }

    // ── Patient-scoped ─────────────────────────────────────────────────────────

    @GetMapping("/api/patients/{patientId}/pregnancies")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<PregnancyView>> list(@PathVariable UUID patientId) {
        List<Pregnancy> all = pregnancyService.listByPatient(patientId);
        int gravidity = all.size();
        int parity = (int) all.stream()
                .filter(p -> p.getOutcome() != null && LIVE_BIRTH_OUTCOMES.contains(p.getOutcome()))
                .count();
        List<PregnancyView> views = all.stream()
                .map(p -> toView(p, gravidity, parity))
                .toList();
        return ResponseEntity.ok(views);
    }

    @GetMapping("/api/patients/{patientId}/pregnancies/current")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<PregnancyView> current(@PathVariable UUID patientId) {
        Pregnancy p = pregnancyService.findCurrent(patientId)
                .orElseThrow(() -> new NotFoundException("PREGNANCY_NOT_FOUND",
                        "Aucune grossesse en cours pour cette patiente."));

        List<Pregnancy> all = pregnancyRepo.findByPatientIdOrderByStartedAtDesc(patientId);
        int gravidity = all.size();
        int parity = (int) all.stream()
                .filter(pr -> pr.getOutcome() != null && LIVE_BIRTH_OUTCOMES.contains(pr.getOutcome()))
                .count();
        return ResponseEntity.ok(toView(p, gravidity, parity));
    }

    @PostMapping("/api/patients/{patientId}/pregnancies")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<PregnancyView> declare(
            @PathVariable UUID patientId,
            @Valid @RequestBody DeclarePregnancyRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        Pregnancy p = pregnancyService.declare(patientId, req.lmpDate(), req.notes(), actorId);

        List<Pregnancy> all = pregnancyRepo.findByPatientIdOrderByStartedAtDesc(patientId);
        int gravidity = all.size();
        int parity = (int) all.stream()
                .filter(pr -> pr.getOutcome() != null && LIVE_BIRTH_OUTCOMES.contains(pr.getOutcome()))
                .count();

        PregnancyView view = toView(p, gravidity, parity);
        return ResponseEntity.created(
                URI.create("/api/pregnancies/" + p.getId()))
                .body(view);
    }

    // ── Pregnancy-scoped ──────────────────────────────────────────────────────

    @PutMapping("/api/pregnancies/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<PregnancyView> update(
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePregnancyRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        Pregnancy p = pregnancyService.update(id, req.lmpDate(), req.dueDate(),
                req.dueDateSource(), req.notes(), actorId);
        return ResponseEntity.ok(toView(p, computeGravidity(p.getPatientId()),
                computeParity(p.getPatientId())));
    }

    @PostMapping("/api/pregnancies/{id}/close")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<PregnancyView> close(
            @PathVariable UUID id,
            @Valid @RequestBody ClosePregnancyRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        Pregnancy p = pregnancyService.close(id, req.endedAt(), req.outcome(), req.notes(), actorId);
        return ResponseEntity.ok(toView(p, computeGravidity(p.getPatientId()),
                computeParity(p.getPatientId())));
    }

    @PostMapping("/api/pregnancies/{id}/create-child")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> createChild(
            @PathVariable UUID id,
            @Valid @RequestBody CreateChildRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        UUID childId = pregnancyService.createChild(id, req.firstName(), req.sex().charAt(0), actorId);
        return ResponseEntity.created(
                URI.create("/api/patients/" + childId))
                .build();
    }

    // ── Visit plan ────────────────────────────────────────────────────────────

    @GetMapping("/api/pregnancies/{id}/plan")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<PregnancyVisitPlanView>> getPlan(@PathVariable UUID id) {
        List<PregnancyVisitPlan> plan = pregnancyService.getVisitPlan(id);
        List<PregnancyVisitPlanView> views = plan.stream()
                .map(mapper::toPlanView)
                .toList();
        return ResponseEntity.ok(views);
    }

    @PutMapping("/api/pregnancies/{id}/plan/{planId}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<PregnancyVisitPlanView> updatePlan(
            @PathVariable UUID id,
            @PathVariable UUID planId,
            @RequestBody PregnancyVisitPlanUpdateRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        PregnancyVisitPlan updated = pregnancyService.updateVisitPlanEntry(
                id, planId, req.targetDate(), req.status(), actorId);
        return ResponseEntity.ok(mapper.toPlanView(updated));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private PregnancyView toView(Pregnancy p, int gravidity, int parity) {
        Integer saWeeks = null;
        Integer saDays = null;
        if (p.getStatus() == ma.careplus.pregnancy.domain.PregnancyStatus.EN_COURS
                && p.getLmpDate() != null) {
            long totalDays = ChronoUnit.DAYS.between(p.getLmpDate(), LocalDate.now());
            saWeeks = (int) (totalDays / 7);
            saDays = (int) (totalDays % 7);
        }
        return mapper.toView(p, saWeeks, saDays, gravidity, parity);
    }

    private int computeGravidity(UUID patientId) {
        return pregnancyRepo.findByPatientIdOrderByStartedAtDesc(patientId).size();
    }

    private int computeParity(UUID patientId) {
        return (int) pregnancyRepo.findByPatientIdOrderByStartedAtDesc(patientId).stream()
                .filter(pr -> pr.getOutcome() != null && LIVE_BIRTH_OUTCOMES.contains(pr.getOutcome()))
                .count();
    }
}
