package ma.careplus.pregnancy.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * A single entry in the auto-generated prenatal visit plan (OMS 2016 — 8 visits).
 * One row per SA target per pregnancy. Auto-created at pregnancy declaration;
 * modifiable by MEDECIN.
 */
@Entity
@Table(name = "pregnancy_visit_plan")
public class PregnancyVisitPlan {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "pregnancy_id", nullable = false)
    private UUID pregnancyId;

    @Column(name = "target_sa_weeks", nullable = false)
    private short targetSaWeeks;

    @Column(name = "target_date", nullable = false)
    private LocalDate targetDate;

    @Column(name = "tolerance_days", nullable = false)
    private int toleranceDays = 14;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 10)
    private VisitPlanStatus status = VisitPlanStatus.PLANIFIEE;

    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Column(name = "consultation_id")
    private UUID consultationId;

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

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getPregnancyId() { return pregnancyId; }
    public void setPregnancyId(UUID pregnancyId) { this.pregnancyId = pregnancyId; }

    public short getTargetSaWeeks() { return targetSaWeeks; }
    public void setTargetSaWeeks(short targetSaWeeks) { this.targetSaWeeks = targetSaWeeks; }

    public LocalDate getTargetDate() { return targetDate; }
    public void setTargetDate(LocalDate targetDate) { this.targetDate = targetDate; }

    public int getToleranceDays() { return toleranceDays; }
    public void setToleranceDays(int toleranceDays) { this.toleranceDays = toleranceDays; }

    public VisitPlanStatus getStatus() { return status; }
    public void setStatus(VisitPlanStatus status) { this.status = status; }

    public UUID getAppointmentId() { return appointmentId; }
    public void setAppointmentId(UUID appointmentId) { this.appointmentId = appointmentId; }

    public UUID getConsultationId() { return consultationId; }
    public void setConsultationId(UUID consultationId) { this.consultationId = consultationId; }

    public long getVersion() { return version; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
