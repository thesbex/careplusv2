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
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Obstetric biometry recorded at each prenatal visit.
 * Mapped to {@code pregnancy_visit} (created by V026).
 *
 * <p>Field {@code urineDip} stores JSONB:
 * {@code {"glucose":bool,"protein":bool,"leuco":bool,"nitrites":bool,"ketones":bool,"blood":bool}}.
 *
 * <p>{@code saWeeks} + {@code saDays} are always computed from
 * {@code (recordedAt - pregnancy.lmpDate)} by the service — they are never supplied
 * by the caller.
 */
@Entity
@Table(name = "pregnancy_visit")
public class PregnancyVisit {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "pregnancy_id", nullable = false)
    private UUID pregnancyId;

    @Column(name = "visit_plan_id")
    private UUID visitPlanId;

    @Column(name = "consultation_id")
    private UUID consultationId;

    @Column(name = "recorded_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime recordedAt;

    @Column(name = "sa_weeks", nullable = false)
    private short saWeeks;

    @Column(name = "sa_days", nullable = false)
    private short saDays;

    @Column(name = "weight_kg", precision = 5, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "bp_systolic")
    private Short bpSystolic;

    @Column(name = "bp_diastolic")
    private Short bpDiastolic;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "urine_dip", columnDefinition = "JSONB")
    private String urineDipJson;

    @Column(name = "fundal_height_cm", precision = 4, scale = 1)
    private BigDecimal fundalHeightCm;

    @Column(name = "fetal_heart_rate_bpm")
    private Short fetalHeartRateBpm;

    @Column(name = "fetal_movements_perceived")
    private Boolean fetalMovementsPerceived;

    @Enumerated(EnumType.STRING)
    @Column(name = "presentation", length = 16)
    private Presentation presentation;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "recorded_by", nullable = false)
    private UUID recordedBy;

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

    public UUID getPregnancyId() { return pregnancyId; }
    public void setPregnancyId(UUID pregnancyId) { this.pregnancyId = pregnancyId; }

    public UUID getVisitPlanId() { return visitPlanId; }
    public void setVisitPlanId(UUID visitPlanId) { this.visitPlanId = visitPlanId; }

    public UUID getConsultationId() { return consultationId; }
    public void setConsultationId(UUID consultationId) { this.consultationId = consultationId; }

    public OffsetDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(OffsetDateTime recordedAt) { this.recordedAt = recordedAt; }

    public short getSaWeeks() { return saWeeks; }
    public void setSaWeeks(short saWeeks) { this.saWeeks = saWeeks; }

    public short getSaDays() { return saDays; }
    public void setSaDays(short saDays) { this.saDays = saDays; }

    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal weightKg) { this.weightKg = weightKg; }

    public Short getBpSystolic() { return bpSystolic; }
    public void setBpSystolic(Short bpSystolic) { this.bpSystolic = bpSystolic; }

    public Short getBpDiastolic() { return bpDiastolic; }
    public void setBpDiastolic(Short bpDiastolic) { this.bpDiastolic = bpDiastolic; }

    public String getUrineDipJson() { return urineDipJson; }
    public void setUrineDipJson(String urineDipJson) { this.urineDipJson = urineDipJson; }

    public BigDecimal getFundalHeightCm() { return fundalHeightCm; }
    public void setFundalHeightCm(BigDecimal fundalHeightCm) { this.fundalHeightCm = fundalHeightCm; }

    public Short getFetalHeartRateBpm() { return fetalHeartRateBpm; }
    public void setFetalHeartRateBpm(Short fetalHeartRateBpm) { this.fetalHeartRateBpm = fetalHeartRateBpm; }

    public Boolean getFetalMovementsPerceived() { return fetalMovementsPerceived; }
    public void setFetalMovementsPerceived(Boolean fetalMovementsPerceived) {
        this.fetalMovementsPerceived = fetalMovementsPerceived;
    }

    public Presentation getPresentation() { return presentation; }
    public void setPresentation(Presentation presentation) { this.presentation = presentation; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public UUID getRecordedBy() { return recordedBy; }
    public void setRecordedBy(UUID recordedBy) { this.recordedBy = recordedBy; }

    public long getVersion() { return version; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
