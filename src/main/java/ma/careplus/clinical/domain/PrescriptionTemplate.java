package ma.careplus.clinical.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Modèle de prescription réutilisable, privé au médecin (filtré par JWT).
 * Les lignes sont stockées en JSONB — la forme dépend de {@link #type} :
 *   DRUG    : [{ medicationId, medicationCode, dosage, frequency, duration, quantity, instructions }]
 *   LAB     : [{ labTestId, labTestCode, instructions }]
 *   IMAGING : [{ imagingExamId, imagingExamCode, instructions }]
 *
 * Le service sérialise/désérialise via Jackson ; l'entité ne porte que le JSON brut.
 * Soft-delete via {@code deletedAt} pour conserver l'historique sans casser
 * les références.
 */
@Entity
@Table(name = "clinical_prescription_template")
public class PrescriptionTemplate {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "practitioner_id", nullable = false)
    private UUID practitionerId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "type", nullable = false, length = 16)
    private String type;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lines", nullable = false, columnDefinition = "JSONB")
    private String linesJson;

    @Column(name = "deleted_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime deletedAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

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

    public UUID getId() { return id; }
    public UUID getPractitionerId() { return practitionerId; }
    public void setPractitionerId(UUID v) { this.practitionerId = v; }
    public String getName() { return name; }
    public void setName(String v) { this.name = v; }
    public String getType() { return type; }
    public void setType(String v) { this.type = v; }
    public String getLinesJson() { return linesJson; }
    public void setLinesJson(String v) { this.linesJson = v; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime v) { this.deletedAt = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
