package ma.careplus.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Prescription aggregate. Maps clinical_prescription (V001 + V004 additions:
 * patient_id, allergy_override, allergy_override_reason).
 *
 * A prescription is always linked to a consultation (must be BROUILLON at creation).
 * Multiple prescriptions per consultation are allowed (one per type: DRUG, LAB, …).
 */
@Entity
@Table(name = "clinical_prescription")
public class Prescription {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "consultation_id", nullable = false)
    private UUID consultationId;

    @Column(name = "patient_id")
    private UUID patientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16)
    private PrescriptionType type;

    @Column(name = "issued_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime issuedAt;

    @Column(name = "allergy_override", nullable = false)
    private boolean allergyOverride = false;

    @Column(name = "allergy_override_reason", columnDefinition = "TEXT")
    private String allergyOverrideReason;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "pdf_storage_key", length = 255)
    private String pdfStorageKey;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (issuedAt == null) issuedAt = createdAt;
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public UUID getConsultationId() { return consultationId; }
    public void setConsultationId(UUID consultationId) { this.consultationId = consultationId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public PrescriptionType getType() { return type; }
    public void setType(PrescriptionType type) { this.type = type; }
    public OffsetDateTime getIssuedAt() { return issuedAt; }
    public void setIssuedAt(OffsetDateTime issuedAt) { this.issuedAt = issuedAt; }
    public boolean isAllergyOverride() { return allergyOverride; }
    public void setAllergyOverride(boolean allergyOverride) { this.allergyOverride = allergyOverride; }
    public String getAllergyOverrideReason() { return allergyOverrideReason; }
    public void setAllergyOverrideReason(String allergyOverrideReason) { this.allergyOverrideReason = allergyOverrideReason; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public String getPdfStorageKey() { return pdfStorageKey; }
    public void setPdfStorageKey(String pdfStorageKey) { this.pdfStorageKey = pdfStorageKey; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
