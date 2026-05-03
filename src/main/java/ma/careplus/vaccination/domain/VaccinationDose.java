package ma.careplus.vaccination.domain;

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
 * Doses réellement administrées/planifiées par patient.
 * Maps vaccination_dose (V022).
 * Soft-delete via deleted_at.
 * Optimistic locking via @Version.
 */
@Entity
@Table(name = "vaccination_dose")
public class VaccinationDose {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    /** Nullable: null = dose hors calendrier (rattrapage, hors-PNI). */
    @Column(name = "schedule_dose_id")
    private UUID scheduleDoseId;

    @Column(name = "vaccine_id", nullable = false)
    private UUID vaccineId;

    @Column(name = "dose_number", nullable = false)
    private short doseNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private VaccinationStatus status = VaccinationStatus.PLANNED;

    @Column(name = "administered_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime administeredAt;

    @Column(name = "lot_number", length = 100)
    private String lotNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "route", length = 8)
    private VaccinationRoute route;

    /** Deltoïde G/D, vaste latéral G/D, oral, ID */
    @Column(name = "site", length = 100)
    private String site;

    @Column(name = "administered_by")
    private UUID administeredBy;

    @Column(name = "deferral_reason", length = 500)
    private String deferralReason;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "deleted_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime deletedAt;

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

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public UUID getScheduleDoseId() { return scheduleDoseId; }
    public void setScheduleDoseId(UUID scheduleDoseId) { this.scheduleDoseId = scheduleDoseId; }

    public UUID getVaccineId() { return vaccineId; }
    public void setVaccineId(UUID vaccineId) { this.vaccineId = vaccineId; }

    public short getDoseNumber() { return doseNumber; }
    public void setDoseNumber(short doseNumber) { this.doseNumber = doseNumber; }

    public VaccinationStatus getStatus() { return status; }
    public void setStatus(VaccinationStatus status) { this.status = status; }

    public OffsetDateTime getAdministeredAt() { return administeredAt; }
    public void setAdministeredAt(OffsetDateTime administeredAt) { this.administeredAt = administeredAt; }

    public String getLotNumber() { return lotNumber; }
    public void setLotNumber(String lotNumber) { this.lotNumber = lotNumber; }

    public VaccinationRoute getRoute() { return route; }
    public void setRoute(VaccinationRoute route) { this.route = route; }

    public String getSite() { return site; }
    public void setSite(String site) { this.site = site; }

    public UUID getAdministeredBy() { return administeredBy; }
    public void setAdministeredBy(UUID administeredBy) { this.administeredBy = administeredBy; }

    public String getDeferralReason() { return deferralReason; }
    public void setDeferralReason(String deferralReason) { this.deferralReason = deferralReason; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public long getVersion() { return version; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
