package ma.careplus.clinical.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/** Clinical vital-signs record. Append-only — updates replace via new rows. */
@Entity
@Table(name = "clinical_vital_signs")
public class VitalSigns {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Column(name = "consultation_id")
    private UUID consultationId;

    @Column(name = "systolic_mmhg")
    private Integer systolicMmhg;

    @Column(name = "diastolic_mmhg")
    private Integer diastolicMmhg;

    @Column(name = "temperature_c")
    private BigDecimal temperatureC;

    @Column(name = "weight_kg")
    private BigDecimal weightKg;

    @Column(name = "height_cm")
    private BigDecimal heightCm;

    @Column(name = "bmi")
    private BigDecimal bmi;

    @Column(name = "heart_rate_bpm")
    private Integer heartRateBpm;

    @Column(name = "spo2_percent")
    private Integer spo2Percent;

    @Column(name = "glycemia_g_per_l")
    private BigDecimal glycemiaGPerL;

    @Column(name = "recorded_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime recordedAt;

    @Column(name = "recorded_by", nullable = false)
    private UUID recordedBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        if (recordedAt == null) recordedAt = now;
        if (createdAt == null) createdAt = now;
        updatedAt = createdAt;
    }

    // Getters/setters
    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID v) { this.patientId = v; }
    public UUID getAppointmentId() { return appointmentId; }
    public void setAppointmentId(UUID v) { this.appointmentId = v; }
    public UUID getConsultationId() { return consultationId; }
    public void setConsultationId(UUID v) { this.consultationId = v; }
    public Integer getSystolicMmhg() { return systolicMmhg; }
    public void setSystolicMmhg(Integer v) { this.systolicMmhg = v; }
    public Integer getDiastolicMmhg() { return diastolicMmhg; }
    public void setDiastolicMmhg(Integer v) { this.diastolicMmhg = v; }
    public BigDecimal getTemperatureC() { return temperatureC; }
    public void setTemperatureC(BigDecimal v) { this.temperatureC = v; }
    public BigDecimal getWeightKg() { return weightKg; }
    public void setWeightKg(BigDecimal v) { this.weightKg = v; }
    public BigDecimal getHeightCm() { return heightCm; }
    public void setHeightCm(BigDecimal v) { this.heightCm = v; }
    public BigDecimal getBmi() { return bmi; }
    public void setBmi(BigDecimal v) { this.bmi = v; }
    public Integer getHeartRateBpm() { return heartRateBpm; }
    public void setHeartRateBpm(Integer v) { this.heartRateBpm = v; }
    public Integer getSpo2Percent() { return spo2Percent; }
    public void setSpo2Percent(Integer v) { this.spo2Percent = v; }
    public BigDecimal getGlycemiaGPerL() { return glycemiaGPerL; }
    public void setGlycemiaGPerL(BigDecimal v) { this.glycemiaGPerL = v; }
    public OffsetDateTime getRecordedAt() { return recordedAt; }
    public UUID getRecordedBy() { return recordedBy; }
    public void setRecordedBy(UUID v) { this.recordedBy = v; }
    public String getNotes() { return notes; }
    public void setNotes(String v) { this.notes = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
