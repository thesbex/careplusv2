package ma.careplus.rooms.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Aggregate: salle de consultation du cabinet.
 * Soft-delete via {@code active = false}.
 * capability_tags est stocké comme TEXT[] Postgres via @JdbcTypeCode(SqlTypes.ARRAY).
 */
@Entity
@Table(name = "clinic_room")
public class ClinicRoom {

    @Id
    @Column(name = "id")
    private UUID id;

    @Column(name = "name", nullable = false, length = 80)
    private String name;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "capability_tags", columnDefinition = "text[]", nullable = false)
    private List<String> capabilityTags = new ArrayList<>();

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

    // Getters / setters

    public UUID getId() { return id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<String> getCapabilityTags() { return capabilityTags; }
    public void setCapabilityTags(List<String> capabilityTags) {
        this.capabilityTags = capabilityTags != null ? capabilityTags : new ArrayList<>();
    }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Long getVersion() { return version; }
}
