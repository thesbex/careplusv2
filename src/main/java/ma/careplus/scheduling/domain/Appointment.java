package ma.careplus.scheduling.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Appointment aggregate. Carries the presence-state-machine timestamps
 * (arrived_at, vitals_started_at, consultation_started_at, …) — those are
 * populated by the check-in / vitals / consultation flows in J5, not by
 * the scheduling module itself. Scheduling owns: creation, move, cancel,
 * conflict detection, walk-in flag, urgence flag.
 */
@Entity
@Table(name = "scheduling_appointment")
public class Appointment {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "practitioner_id", nullable = false)
    private UUID practitionerId;

    @Column(name = "reason_id")
    private UUID reasonId;

    @Column(name = "start_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime startAt;

    @Column(name = "end_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime endAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private AppointmentStatus status = AppointmentStatus.PLANIFIE;

    @Column(name = "cancel_reason", length = 255)
    private String cancelReason;

    @Column(name = "walk_in", nullable = false)
    private boolean walkIn = false;

    @Column(name = "urgency", nullable = false)
    private boolean urgency = false;

    @Column(name = "arrived_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime arrivedAt;

    @Column(name = "vitals_started_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime vitalsStartedAt;

    @Column(name = "vitals_ended_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime vitalsEndedAt;

    @Column(name = "consultation_started_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime consultationStartedAt;

    @Column(name = "consultation_ended_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime consultationEndedAt;

    @Column(name = "invoiced_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime invoicedAt;

    @Column(name = "left_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime leftAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // Getters / setters
    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID v) { this.patientId = v; }
    public UUID getPractitionerId() { return practitionerId; }
    public void setPractitionerId(UUID v) { this.practitionerId = v; }
    public UUID getReasonId() { return reasonId; }
    public void setReasonId(UUID v) { this.reasonId = v; }
    public OffsetDateTime getStartAt() { return startAt; }
    public void setStartAt(OffsetDateTime v) { this.startAt = v; }
    public OffsetDateTime getEndAt() { return endAt; }
    public void setEndAt(OffsetDateTime v) { this.endAt = v; }
    public AppointmentStatus getStatus() { return status; }
    public void setStatus(AppointmentStatus v) { this.status = v; }
    public String getCancelReason() { return cancelReason; }
    public void setCancelReason(String v) { this.cancelReason = v; }
    public boolean isWalkIn() { return walkIn; }
    public void setWalkIn(boolean v) { this.walkIn = v; }
    public boolean isUrgency() { return urgency; }
    public void setUrgency(boolean v) { this.urgency = v; }
    public OffsetDateTime getArrivedAt() { return arrivedAt; }
    public OffsetDateTime getVitalsStartedAt() { return vitalsStartedAt; }
    public OffsetDateTime getConsultationStartedAt() { return consultationStartedAt; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID v) { this.createdBy = v; }
    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID v) { this.updatedBy = v; }
}
