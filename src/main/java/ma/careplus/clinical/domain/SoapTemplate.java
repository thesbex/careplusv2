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

/**
 * Modèle de consultation SOAP réutilisable, privé au médecin (filtré par JWT).
 * Pré-remplit les 4 champs SOAP depuis l'écran consultation. Soft-delete.
 */
@Entity
@Table(name = "clinical_soap_template")
public class SoapTemplate {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "practitioner_id", nullable = false)
    private UUID practitionerId;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "subjectif")
    private String subjectif;

    @Column(name = "objectif")
    private String objectif;

    @Column(name = "analyse_note")
    private String analyse;

    @Column(name = "plan")
    private String plan;

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
    public String getSubjectif() { return subjectif; }
    public void setSubjectif(String v) { this.subjectif = v; }
    public String getObjectif() { return objectif; }
    public void setObjectif(String v) { this.objectif = v; }
    public String getAnalyse() { return analyse; }
    public void setAnalyse(String v) { this.analyse = v; }
    public String getPlan() { return plan; }
    public void setPlan(String v) { this.plan = v; }
    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime v) { this.deletedAt = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
