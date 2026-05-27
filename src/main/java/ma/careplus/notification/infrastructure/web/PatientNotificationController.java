package ma.careplus.notification.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import ma.careplus.notification.infrastructure.web.dto.PatientNotificationPrefs;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Préférences de notification du patient (consentement + canal). Les colonnes
 * {@code notifications_opt_in/channel} ont été ajoutées par V065 (module
 * notification) → ce module les pilote, en lecture/écriture JdbcTemplate, sans
 * toucher l'entité du module patient.
 */
@RestController
@RequestMapping("/api/patients/{patientId}/notification-preferences")
@Tag(name = "Notifications", description = "Consentement notifications du patient.")
public class PatientNotificationController {

    private final JdbcTemplate jdbc;

    public PatientNotificationController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','INFIRMIER','MEDECIN','ADMIN','RECEPTIONNISTE')")
    public PatientNotificationPrefs get(@PathVariable UUID patientId) {
        List<PatientNotificationPrefs> rows = jdbc.query(
                "SELECT notifications_opt_in, notifications_channel FROM patient_patient WHERE id = ? AND deleted_at IS NULL",
                (rs, i) -> new PatientNotificationPrefs(
                        rs.getBoolean("notifications_opt_in"),
                        rs.getString("notifications_channel")),
                patientId);
        if (rows.isEmpty()) {
            throw new NotFoundException("PATIENT_NOT_FOUND", "Patient introuvable : " + patientId);
        }
        return rows.get(0);
    }

    @PutMapping
    @Transactional
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','INFIRMIER','MEDECIN','ADMIN','RECEPTIONNISTE')")
    public ResponseEntity<PatientNotificationPrefs> update(
            @PathVariable UUID patientId,
            @Valid @RequestBody PatientNotificationPrefs prefs) {
        String channel = prefs.channel() == null || prefs.channel().isBlank() ? null : prefs.channel();
        int updated = jdbc.update(
                "UPDATE patient_patient SET notifications_opt_in = ?, notifications_channel = ?, updated_at = now() WHERE id = ? AND deleted_at IS NULL",
                prefs.optIn(), channel, patientId);
        if (updated == 0) {
            throw new NotFoundException("PATIENT_NOT_FOUND", "Patient introuvable : " + patientId);
        }
        return ResponseEntity.ok(new PatientNotificationPrefs(prefs.optIn(), channel));
    }
}
