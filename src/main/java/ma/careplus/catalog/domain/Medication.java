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
 * Medication from the catalog. Maps catalog_medication (V001).
 * Read-only from the catalog module perspective — write path is admin-only
 * and out of J6 scope (seeded via R__seed_dev.sql or V002).
 */
@Entity
@Table(name = "catalog_medication")
public class Medication {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "commercial_name", nullable = false, length = 255)
    private String commercialName;

    /** DCI = Dénomination Commune Internationale (INN / molecule name). */
    @Column(name = "dci", nullable = false, length = 255)
    private String dci;

    @Column(name = "form", nullable = false, length = 64)
    private String form;

    @Column(name = "dosage", nullable = false, length = 64)
    private String dosage;

    @Column(name = "atc_code", length = 16)
    private String atcCode;

    /** Allergen class tags (penicillines, iode, …). */
    @Column(name = "tags", length = 255)
    private String tags;

    @Column(name = "favorite", nullable = false)
    private boolean favorite = false;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

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

    // ── Getters ───────────────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public String getCommercialName() { return commercialName; }
    public void setCommercialName(String commercialName) { this.commercialName = commercialName; }
    public String getDci() { return dci; }
    public void setDci(String dci) { this.dci = dci; }
    public String getForm() { return form; }
    public void setForm(String form) { this.form = form; }
    public String getDosage() { return dosage; }
    public void setDosage(String dosage) { this.dosage = dosage; }
    public String getAtcCode() { return atcCode; }
    public void setAtcCode(String atcCode) { this.atcCode = atcCode; }
    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }
    public boolean isFavorite() { return favorite; }
    public void setFavorite(boolean favorite) { this.favorite = favorite; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
