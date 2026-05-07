package ma.careplus.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Many-to-many link between a non-medical user (SECRETAIRE / ASSISTANT) and a
 * practitioner (MEDECIN). Drives agenda + queue filtering when the cabinet has
 * more than one médecin and {@code agenda_strict_isolation} is enabled.
 *
 * <p>No surrogate id — the (user_id, practitioner_id) pair is the natural key
 * and is exactly the granularity we want unique. {@link IdClass} is used over
 * {@code @EmbeddedId} so each FK column stays a top-level field, which keeps
 * JPQL queries (e.g. {@code findByUserId}) ergonomic and matches the project
 * convention for composite keys.
 */
@Entity
@Table(name = "identity_user_assignment")
@IdClass(UserAssignmentId.class)
public class UserAssignment {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Id
    @Column(name = "practitioner_id", nullable = false, updatable = false)
    private UUID practitionerId;

    @Column(name = "created_at", nullable = false, updatable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    protected UserAssignment() {}

    public UserAssignment(UUID userId, UUID practitionerId) {
        this.userId = userId;
        this.practitionerId = practitionerId;
    }

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = OffsetDateTime.now();
        }
    }

    public UUID getUserId() { return userId; }
    public UUID getPractitionerId() { return practitionerId; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
}
