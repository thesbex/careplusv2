package ma.careplus.hospitalization.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Acte / service supplémentaire fourni pendant un séjour hospitalier.
 * S'ajoute au prix de journée et est inclus dans la facture de séjour.
 * Suppression physique autorisée tant que le séjour n'est pas encore facturé.
 */
@Entity
@Table(name = "hospitalization_stay_prestation")
public class StayPrestation {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "stay_id", nullable = false)
    private UUID stayId;

    @Column(name = "act_id")
    private UUID actId;

    @Column(name = "label", nullable = false, length = 255)
    private String label;

    @Column(name = "unit_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "quantity", nullable = false, precision = 10, scale = 2)
    private BigDecimal quantity = BigDecimal.ONE;

    @Column(name = "performed_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant performedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (performedAt == null) performedAt = createdAt;
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }

    public UUID getStayId() { return stayId; }
    public void setStayId(UUID v) { this.stayId = v; }

    public UUID getActId() { return actId; }
    public void setActId(UUID v) { this.actId = v; }

    public String getLabel() { return label; }
    public void setLabel(String v) { this.label = v; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal v) { this.unitPrice = v; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal v) { this.quantity = v != null ? v : BigDecimal.ONE; }

    public Instant getPerformedAt() { return performedAt; }
    public void setPerformedAt(Instant v) { this.performedAt = v; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID v) { this.createdBy = v; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
