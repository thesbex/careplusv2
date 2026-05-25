package ma.careplus.hospitalization.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Affectation d'un lit à un séjour sur un intervalle (historique ADT).
 * {@code toAt == null} = affectation courante. {@code dailyRateAmount} gelé
 * depuis la chambre au moment de l'affectation.
 */
@Entity
@Table(name = "hospitalization_bed_assignment")
public class BedAssignment {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "stay_id", nullable = false)
    private UUID stayId;

    @Column(name = "bed_id", nullable = false)
    private UUID bedId;

    @Column(name = "daily_rate_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal dailyRateAmount = BigDecimal.ZERO;

    @Column(name = "from_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant fromAt;

    @Column(name = "to_at", columnDefinition = "TIMESTAMPTZ")
    private Instant toAt;

    @Column(name = "assigned_by")
    private UUID assignedBy;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (fromAt == null) fromAt = createdAt;
    }

    public UUID getId() { return id; }

    public UUID getStayId() { return stayId; }
    public void setStayId(UUID v) { this.stayId = v; }

    public UUID getBedId() { return bedId; }
    public void setBedId(UUID v) { this.bedId = v; }

    public BigDecimal getDailyRateAmount() { return dailyRateAmount; }
    public void setDailyRateAmount(BigDecimal v) { this.dailyRateAmount = v != null ? v : BigDecimal.ZERO; }

    public Instant getFromAt() { return fromAt; }
    public void setFromAt(Instant v) { this.fromAt = v; }

    public Instant getToAt() { return toAt; }
    public void setToAt(Instant v) { this.toAt = v; }

    public UUID getAssignedBy() { return assignedBy; }
    public void setAssignedBy(UUID v) { this.assignedBy = v; }

    public Instant getCreatedAt() { return createdAt; }
}
