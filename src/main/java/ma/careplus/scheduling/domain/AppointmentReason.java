package ma.careplus.scheduling.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Reason for an appointment — seed contains Consultation, Suivi, Vaccination, Urgence, etc. */
@Entity
@Table(name = "scheduling_appointment_reason")
public class AppointmentReason {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 32)
    private String code;

    @Column(name = "label", nullable = false, length = 128)
    private String label;

    @Column(name = "duration_minutes", nullable = false)
    private int durationMinutes;

    @Column(name = "default_act_id")
    private UUID defaultActId;

    @Column(name = "color_hex", length = 7)
    private String colorHex;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public int getDurationMinutes() { return durationMinutes; }
    public UUID getDefaultActId() { return defaultActId; }
    public String getColorHex() { return colorHex; }
    public boolean isActive() { return active; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
