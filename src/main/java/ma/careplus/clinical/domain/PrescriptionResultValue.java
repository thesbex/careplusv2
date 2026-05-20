package ma.careplus.clinical.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * V047 — résultat structuré (analyte / valeur / unité) attaché à une ligne
 * LAB / IMAGING. Sert de source à l'évolution graphée dans le dossier
 * patient.
 *
 * <p>{@code analyte_normalized} est une colonne calculée côté Postgres
 * (lower+trim). On la mappe en {@link jakarta.persistence.Transient} pas
 * nécessaire, mais on la marque {@code insertable=false, updatable=false}
 * pour que JPA ne tente pas de l'écrire.
 */
@Entity
@Table(name = "clinical_prescription_result_value")
public class PrescriptionResultValue {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "prescription_line_id", nullable = false)
    private UUID prescriptionLineId;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "analyte", nullable = false, length = 120)
    private String analyte;

    @Column(name = "analyte_normalized", length = 120,
            insertable = false, updatable = false)
    private String analyteNormalized;

    @Column(name = "value_numeric", nullable = false, precision = 14, scale = 4)
    private BigDecimal valueNumeric;

    @Column(name = "unit", length = 40)
    private String unit;

    @Column(name = "recorded_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime recordedAt;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (recordedAt == null) recordedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public UUID getPrescriptionLineId() { return prescriptionLineId; }
    public void setPrescriptionLineId(UUID prescriptionLineId) { this.prescriptionLineId = prescriptionLineId; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public String getAnalyte() { return analyte; }
    public void setAnalyte(String analyte) { this.analyte = analyte; }
    public String getAnalyteNormalized() { return analyteNormalized; }
    public BigDecimal getValueNumeric() { return valueNumeric; }
    public void setValueNumeric(BigDecimal valueNumeric) { this.valueNumeric = valueNumeric; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public OffsetDateTime getRecordedAt() { return recordedAt; }
    public void setRecordedAt(OffsetDateTime recordedAt) { this.recordedAt = recordedAt; }
    public int getSortOrder() { return sortOrder; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
