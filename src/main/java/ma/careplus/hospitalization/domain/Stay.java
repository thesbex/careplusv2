package ma.careplus.hospitalization.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

/**
 * Séjour hospitalier (aggregate central). Cycle : EN_COURS → SORTI → FACTURE ;
 * branche ANNULE. Lié 1↔N à {@link BedAssignment} (transferts ADT).
 */
@Entity
@Table(name = "hospitalization_stay")
public class Stay {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "attending_practitioner_id")
    private UUID attendingPractitionerId;

    @Column(name = "admitted_by")
    private UUID admittedBy;

    @Column(name = "admission_reason")
    private String admissionReason;

    @Column(name = "status", nullable = false, length = 16)
    private String status = "EN_COURS";

    @Column(name = "admitted_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant admittedAt;

    @Column(name = "discharged_at", columnDefinition = "TIMESTAMPTZ")
    private Instant dischargedAt;

    @Column(name = "discharge_type", length = 16)
    private String dischargeType;

    @Column(name = "discharge_summary")
    private String dischargeSummary;

    @Column(name = "invoice_id")
    private UUID invoiceId;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant updatedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @Column(name = "deleted_at", columnDefinition = "TIMESTAMPTZ")
    private Instant deletedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (admittedAt == null) admittedAt = createdAt;
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public UUID getAttendingPractitionerId() { return attendingPractitionerId; }
    public void setAttendingPractitionerId(UUID v) { this.attendingPractitionerId = v; }

    public UUID getAdmittedBy() { return admittedBy; }
    public void setAdmittedBy(UUID v) { this.admittedBy = v; }

    public String getAdmissionReason() { return admissionReason; }
    public void setAdmissionReason(String v) { this.admissionReason = v; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getAdmittedAt() { return admittedAt; }
    public void setAdmittedAt(Instant v) { this.admittedAt = v; }

    public Instant getDischargedAt() { return dischargedAt; }
    public void setDischargedAt(Instant v) { this.dischargedAt = v; }

    public String getDischargeType() { return dischargeType; }
    public void setDischargeType(String v) { this.dischargeType = v; }

    public String getDischargeSummary() { return dischargeSummary; }
    public void setDischargeSummary(String v) { this.dischargeSummary = v; }

    public UUID getInvoiceId() { return invoiceId; }
    public void setInvoiceId(UUID v) { this.invoiceId = v; }

    public Long getVersion() { return version; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID v) { this.createdBy = v; }
    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID v) { this.updatedBy = v; }

    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant v) { this.deletedAt = v; }
}
