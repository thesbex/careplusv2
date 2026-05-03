package ma.careplus.catalog.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * One line of a prescription. Maps clinical_prescription_line (V001 + V004 additions:
 * medication_id, lab_test_id, imaging_exam_id, dosage, quantity, instructions,
 * sort_order, updated_at).
 *
 * item_id/item_kind from V001 are kept but explicit FK columns are preferred.
 */
@Entity
@Table(name = "clinical_prescription_line")
public class PrescriptionLine {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "prescription_id", nullable = false)
    private UUID prescriptionId;

    /** Explicit FK to catalog_medication (null for non-drug lines). */
    @Column(name = "medication_id")
    private UUID medicationId;

    /** Explicit FK to catalog_lab_test (null for non-lab lines). */
    @Column(name = "lab_test_id")
    private UUID labTestId;

    /** Explicit FK to catalog_imaging_exam (null for non-imaging lines). */
    @Column(name = "imaging_exam_id")
    private UUID imagingExamId;

    @Column(name = "free_text", columnDefinition = "TEXT")
    private String freeText;

    /** dosage from V004 (dose from V001 kept separately). */
    @Column(name = "dosage", length = 64)
    private String dosage;

    @Column(name = "dose", length = 64)
    private String dose;

    @Column(name = "frequency", length = 64)
    private String frequency;

    @Column(name = "duration", length = 64)
    private String duration;

    @Column(name = "route", length = 32)
    private String route;

    @Column(name = "timing", length = 64)
    private String timing;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "instructions", columnDefinition = "TEXT")
    private String instructions;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 0;

    @Column(name = "position", nullable = false)
    private int position = 0;

    /**
     * Résultat attaché à la ligne (V015). Pointe vers patient_document
     * (type = RESULTAT). NULL pour les lignes médicament — n'a de sens
     * que pour LAB / IMAGING. ON DELETE SET NULL côté DB.
     */
    @Column(name = "result_document_id")
    private UUID resultDocumentId;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public UUID getPrescriptionId() { return prescriptionId; }
    public void setPrescriptionId(UUID prescriptionId) { this.prescriptionId = prescriptionId; }
    public UUID getMedicationId() { return medicationId; }
    public void setMedicationId(UUID medicationId) { this.medicationId = medicationId; }
    public UUID getLabTestId() { return labTestId; }
    public void setLabTestId(UUID labTestId) { this.labTestId = labTestId; }
    public UUID getImagingExamId() { return imagingExamId; }
    public void setImagingExamId(UUID imagingExamId) { this.imagingExamId = imagingExamId; }
    public String getFreeText() { return freeText; }
    public void setFreeText(String freeText) { this.freeText = freeText; }
    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }
    public String getDose() { return dose; }
    public void setDose(String dose) { this.dose = dose; }
    public String getFrequency() { return frequency; }
    public void setFrequency(String frequency) { this.frequency = frequency; }
    public String getDuration() { return duration; }
    public void setDuration(String duration) { this.duration = duration; }
    public String getRoute() { return route; }
    public void setRoute(String route) { this.route = route; }
    public String getTiming() { return timing; }
    public void setTiming(String timing) { this.timing = timing; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getInstructions() { return instructions; }
    public void setInstructions(String instructions) { this.instructions = instructions; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public int getPosition() { return position; }
    public void setPosition(int position) { this.position = position; }
    public UUID getResultDocumentId() { return resultDocumentId; }
    public void setResultDocumentId(UUID resultDocumentId) { this.resultDocumentId = resultDocumentId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
