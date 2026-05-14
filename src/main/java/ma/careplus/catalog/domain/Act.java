package ma.careplus.catalog.domain;

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
 * Medical act from the catalog. Maps catalog_act (V001 + V004 type column).
 * Acts are the billable procedures offered by the cabinet.
 */
@Entity
@Table(name = "catalog_act")
public class Act {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "code", nullable = false, unique = true, length = 32)
    private String code;

    @Column(name = "name", nullable = false, length = 255)
    private String name;

    @Column(name = "default_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal defaultPrice = BigDecimal.ZERO;

    @Column(name = "vat_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal vatRate = BigDecimal.ZERO;

    /** Act category — added by V004. DEFAULT 'CONSULTATION' in DB. */
    @Column(name = "type", nullable = false, length = 20)
    private String type = "CONSULTATION";

    @Column(name = "active", nullable = false)
    private boolean active = true;

    /** V041 — eligible for CNOPS tiers-payant. */
    @Column(name = "cnops_eligible", nullable = false)
    private boolean cnopsEligible = true;

    /** V041 — eligible for CNSS. */
    @Column(name = "cnss_eligible", nullable = false)
    private boolean cnssEligible = true;

    /** V041 — eligible for RAMED. */
    @Column(name = "ramed_eligible", nullable = false)
    private boolean ramedEligible = true;

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

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getDefaultPrice() { return defaultPrice; }
    public void setDefaultPrice(BigDecimal defaultPrice) { this.defaultPrice = defaultPrice; }
    public BigDecimal getVatRate() { return vatRate; }
    public void setVatRate(BigDecimal vatRate) { this.vatRate = vatRate; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isCnopsEligible() { return cnopsEligible; }
    public void setCnopsEligible(boolean v) { this.cnopsEligible = v; }
    public boolean isCnssEligible() { return cnssEligible; }
    public void setCnssEligible(boolean v) { this.cnssEligible = v; }
    public boolean isRamedEligible() { return ramedEligible; }
    public void setRamedEligible(boolean v) { this.ramedEligible = v; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
}
