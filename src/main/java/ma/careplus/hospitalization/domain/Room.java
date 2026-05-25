package ma.careplus.hospitalization.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Chambre rattachée à un {@link Ward}. {@code dailyRate} est le prix de journée
 * (MAD) ; il sera gelé sur l'affectation de lit au moment de facturer le séjour
 * (Slice B+) pour garder les factures reproductibles. Soft-delete via {@code active}.
 */
@Entity
@Table(name = "hospitalization_room")
public class Room {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "ward_id", nullable = false)
    private UUID wardId;

    @Column(name = "code", nullable = false, length = 32)
    private String code;

    @Column(name = "label_fr", nullable = false, length = 120)
    private String labelFr;

    /** INDIVIDUELLE | DOUBLE | COMMUNE | SUITE | AUTRE (CHECK en base). */
    @Column(name = "room_class", nullable = false, length = 32)
    private String roomClass = "INDIVIDUELLE";

    @Column(name = "daily_rate", nullable = false, precision = 10, scale = 2)
    private BigDecimal dailyRate = BigDecimal.ZERO;

    @Column(name = "active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant updatedAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }

    public UUID getWardId() { return wardId; }
    public void setWardId(UUID wardId) { this.wardId = wardId; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getLabelFr() { return labelFr; }
    public void setLabelFr(String labelFr) { this.labelFr = labelFr; }

    public String getRoomClass() { return roomClass; }
    public void setRoomClass(String roomClass) { this.roomClass = roomClass; }

    public BigDecimal getDailyRate() { return dailyRate; }
    public void setDailyRate(BigDecimal dailyRate) {
        this.dailyRate = dailyRate != null ? dailyRate : BigDecimal.ZERO;
    }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
