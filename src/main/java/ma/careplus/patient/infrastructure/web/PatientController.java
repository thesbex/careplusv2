package ma.careplus.patient.infrastructure.web;

import jakarta.validation.Valid;
import java.net.URI;
import java.util.UUID;
import ma.careplus.patient.application.PatientService;
import ma.careplus.patient.domain.Allergy;
import ma.careplus.patient.domain.Antecedent;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.web.dto.AllergyView;
import ma.careplus.patient.infrastructure.web.dto.AntecedentView;
import ma.careplus.patient.infrastructure.web.dto.CreateAllergyRequest;
import ma.careplus.patient.infrastructure.web.dto.CreateAntecedentRequest;
import ma.careplus.patient.infrastructure.web.dto.CreatePatientRequest;
import ma.careplus.patient.infrastructure.web.dto.PatientSummary;
import ma.careplus.patient.infrastructure.web.dto.PatientView;
import ma.careplus.patient.infrastructure.web.dto.UpdatePatientRequest;
import ma.careplus.patient.infrastructure.web.mapper.PatientMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Patient CRUD + search + allergies + antecedents.
 *
 * Permissions (per ADR-013 + WORKFLOWS.md role matrix):
 *   - SECRETAIRE / MEDECIN / ADMIN: create, update, read, search
 *   - ASSISTANT: read only
 *   - soft-delete restricted to MEDECIN + ADMIN
 *   - allergies & antecedents: SECRETAIRE/MEDECIN/ADMIN can add
 */
@RestController
@RequestMapping("/api/patients")
public class PatientController {

    private final PatientService service;
    private final PatientMapper mapper;

    public PatientController(PatientService service, PatientMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    // ── Patient endpoints ─────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public ResponseEntity<PatientView> create(@Valid @RequestBody CreatePatientRequest req) {
        Patient created = service.create(req);
        PatientView body = mapper.toView(created, java.util.List.of(), java.util.List.of());
        return ResponseEntity.created(URI.create("/api/patients/" + created.getId())).body(body);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public PatientView getOne(@PathVariable UUID id) {
        Patient p = service.getActive(id);
        return mapper.toView(p, service.getAllergies(id), service.getAntecedents(id));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public Page<PatientSummary> search(
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20) Pageable pageable) {
        return service.search(q, pageable).map(mapper::toSummary);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public PatientView update(@PathVariable UUID id, @Valid @RequestBody UpdatePatientRequest req) {
        Patient p = service.update(id, req);
        return mapper.toView(p, service.getAllergies(id), service.getAntecedents(id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> softDelete(@PathVariable UUID id) {
        service.softDelete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Allergies ──────────────────────────────────────────────────

    @PostMapping("/{id}/allergies")
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public ResponseEntity<AllergyView> addAllergy(
            @PathVariable UUID id,
            @Valid @RequestBody CreateAllergyRequest req) {
        Allergy created = service.addAllergy(id, req);
        return ResponseEntity.created(URI.create("/api/patients/" + id + "/allergies/" + created.getId()))
                .body(mapper.toAllergyView(created));
    }

    // ── Antecedents ────────────────────────────────────────────────

    @PostMapping("/{id}/antecedents")
    @PreAuthorize("hasAnyRole('SECRETAIRE','MEDECIN','ADMIN')")
    public ResponseEntity<AntecedentView> addAntecedent(
            @PathVariable UUID id,
            @Valid @RequestBody CreateAntecedentRequest req) {
        Antecedent created = service.addAntecedent(id, req);
        return ResponseEntity.created(URI.create("/api/patients/" + id + "/antecedents/" + created.getId()))
                .body(mapper.toAntecedentView(created));
    }
}
