package ma.careplus.configuration.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Onboarding wizard completion gate + step-resume persistence.
 *
 * <p>The wizard at <code>/onboarding</code> configures cabinet-level state
 * (clinic identity, working hours, document templates, tarifs). It is forced
 * on first login and on subsequent logins until the admin clicks "Ouvrir mon
 * cabinet" on step 7 — at which point completed_at is stamped and the gate
 * stops triggering. The step persistence is so that a refresh / logout in the
 * middle of the wizard brings the user back where they left off, not back to
 * step 1.
 *
 * <p>Stored on the single-row {@code configuration_clinic_settings} table
 * (V042). When the row doesn't exist yet (very first run, no PUT
 * /api/settings/clinic ever made), the GET returns
 * {@code { completed:false, currentStep:null }} — the FE treats this as
 * "start at step 1".
 */
@RestController
@Tag(name = "settings", description = "Onboarding wizard state (gate + resume)")
public class OnboardingStateController {

    /** Allowed step keys — kept in sync with frontend STEPS array. */
    private static final String ALLOWED_STEPS =
            "cabinet|medecin|horaires|equipe|tarifs|documents|recap";

    private final JdbcTemplate jdbc;

    public OnboardingStateController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record OnboardingStateView(
            boolean completed,
            OffsetDateTime completedAt,
            /** Step key the wizard is parked on. NULL = not started OR completed. */
            String currentStep
    ) {}

    public record UpdateStepRequest(
            @NotBlank @Pattern(regexp = ALLOWED_STEPS) String step
    ) {}

    @GetMapping("/api/settings/onboarding/state")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Lire l'état du wizard d'onboarding (gate + étape courante)")
    public OnboardingStateView get() {
        try {
            return jdbc.queryForObject(
                    "SELECT onboarding_completed_at, onboarding_current_step "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        OffsetDateTime ts = rs.getObject("onboarding_completed_at", OffsetDateTime.class);
                        return new OnboardingStateView(ts != null, ts, rs.getString("onboarding_current_step"));
                    });
        } catch (EmptyResultDataAccessException e) {
            // No clinic row yet — wizard has never been touched.
            return new OnboardingStateView(false, null, null);
        }
    }

    @PutMapping("/api/settings/onboarding/state")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(summary = "Mémoriser l'étape courante (pour reprise après refresh)")
    public OnboardingStateView updateStep(@Valid @RequestBody UpdateStepRequest req) {
        ensureClinicRowExists();
        jdbc.update(
                "UPDATE configuration_clinic_settings "
                        + "SET onboarding_current_step = ?, updated_at = now()",
                req.step());
        return get();
    }

    @PostMapping("/api/settings/onboarding/complete")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    @Operation(summary = "Marquer le wizard comme terminé (CTA final)")
    public OnboardingStateView complete() {
        ensureClinicRowExists();
        jdbc.update(
                "UPDATE configuration_clinic_settings "
                        + "SET onboarding_completed_at = now(), "
                        + "    onboarding_current_step = NULL, "
                        + "    updated_at = now()");
        return get();
    }

    /**
     * The wizard can be hit before the clinic row exists (very first run
     * before any PUT /api/settings/clinic). Create a stub row so the state
     * UPDATE has something to write to. We use empty strings for the required
     * NOT NULL columns — the wizard's step 1 will overwrite them as soon as
     * the admin saves.
     */
    private void ensureClinicRowExists() {
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM configuration_clinic_settings", Integer.class);
        if (existing != null && existing > 0) return;
        jdbc.update(
                "INSERT INTO configuration_clinic_settings "
                        + "(id, name, address, city, phone) "
                        + "VALUES (?, '', '', '', '')",
                UUID.randomUUID());
    }
}
