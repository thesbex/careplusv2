package ma.careplus.stock.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Mouvement de stock — immutable historique.
 * Maps stock_movement (V024).
 * No soft-delete, no updated_at trigger (append-only).
 */
@Entity
@Table(name = "stock_movement")
public class StockMovement {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "article_id", nullable = false, updatable = false)
    private UUID articleId;

    @Column(name = "lot_id", updatable = false)
    private UUID lotId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 16, updatable = false)
    private StockMovementType type;

    @Column(name = "quantity", nullable = false, updatable = false)
    private int quantity;

    @Column(name = "reason", length = 500, updatable = false)
    private String reason;

    @Column(name = "performed_by", nullable = false, updatable = false)
    private UUID performedBy;

    @Column(name = "performed_at", nullable = false, columnDefinition = "TIMESTAMPTZ", updatable = false)
    private OffsetDateTime performedAt;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ", updatable = false)
    private OffsetDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        if (performedAt == null) performedAt = now;
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getArticleId() { return articleId; }
    public void setArticleId(UUID articleId) { this.articleId = articleId; }

    public UUID getLotId() { return lotId; }
    public void setLotId(UUID lotId) { this.lotId = lotId; }

    public StockMovementType getType() { return type; }
    public void setType(StockMovementType type) { this.type = type; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public UUID getPerformedBy() { return performedBy; }
    public void setPerformedBy(UUID performedBy) { this.performedBy = performedBy; }

    public OffsetDateTime getPerformedAt() { return performedAt; }
    public void setPerformedAt(OffsetDateTime performedAt) { this.performedAt = performedAt; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
}
