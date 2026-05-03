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
 * Référentiel éditable des vaccins.
 * Maps vaccine_catalog (V022).
 * is_pni = TRUE → seedé PNI marocain, protégé contre la suppression.
 */
@Entity
@Table(name = "vaccine_catalog")
public class VaccineCatalog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 32)
    private String code;

    @Column(name = "name_fr", nullable = false, length = 255)
    private String nameFr;

    @Column(name = "manufacturer_default", length = 255)
    private String manufacturerDefault;

    @Enumerated(EnumType.STRING)
    @Column(name = "route_default", nullable = false, length = 8)
    private VaccinationRoute routeDefault = VaccinationRoute.IM;

    @Column(name = "is_pni", nullable = false)
    private boolean isPni = false;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

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

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getNameFr() { return nameFr; }
    public void setNameFr(String nameFr) { this.nameFr = nameFr; }

    public String getManufacturerDefault() { return manufacturerDefault; }
    public void setManufacturerDefault(String manufacturerDefault) {
        this.manufacturerDefault = manufacturerDefault;
    }

    public VaccinationRoute getRouteDefault() { return routeDefault; }
    public void setRouteDefault(VaccinationRoute routeDefault) { this.routeDefault = routeDefault; }

    public boolean isPni() { return isPni; }
    public void setPni(boolean pni) { isPni = pni; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public long getVersion() { return version; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
