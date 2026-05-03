package ma.careplus.vaccination.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Calendrier des doses planifiées du PNI (template global éditable).
 * Maps vaccine_schedule_dose (V022).
 * UNIQUE(vaccine_id, dose_number) enforced at DB level.
 */
@Entity
@Table(name = "vaccine_schedule_dose")
public class VaccineScheduleDose {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** FK → vaccine_catalog */
    @Column(name = "vaccine_id", nullable = false)
    private UUID vaccineId;

    /** 1, 2, 3, or rappel number. UNIQUE with vaccine_id. */
    @Column(name = "dose_number", nullable = false)
    private short doseNumber;

    /** Âge cible en jours depuis la naissance (0 = naissance, 60 = 2 mois, …). */
    @Column(name = "target_age_days", nullable = false)
    private int targetAgeDays;

    /** Tolérance en jours pour le calcul "en retard". Default 30. */
    @Column(name = "tolerance_days", nullable = false)
    private int toleranceDays = 30;

    @Column(name = "label_fr", length = 255)
    private String labelFr;

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
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getVaccineId() { return vaccineId; }
    public void setVaccineId(UUID vaccineId) { this.vaccineId = vaccineId; }

    public short getDoseNumber() { return doseNumber; }
    public void setDoseNumber(short doseNumber) { this.doseNumber = doseNumber; }

    public int getTargetAgeDays() { return targetAgeDays; }
    public void setTargetAgeDays(int targetAgeDays) { this.targetAgeDays = targetAgeDays; }

    public int getToleranceDays() { return toleranceDays; }
    public void setToleranceDays(int toleranceDays) { this.toleranceDays = toleranceDays; }

    public String getLabelFr() { return labelFr; }
    public void setLabelFr(String labelFr) { this.labelFr = labelFr; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
