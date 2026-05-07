package ma.careplus.identity.domain;

import java.io.Serializable;
import java.util.UUID;

/**
 * Composite primary key for {@link UserAssignment}.
 *
 * <p>Implemented as a {@link Serializable} record so JPA's {@link jakarta.persistence.IdClass}
 * contract is satisfied (record auto-generates equals + hashCode from the components,
 * which is exactly what JPA needs for identity comparisons in the persistence context).
 */
public record UserAssignmentId(UUID userId, UUID practitionerId) implements Serializable {}
