package ma.careplus.identity.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.identity.domain.UserAssignment;
import ma.careplus.identity.domain.UserAssignmentId;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserAssignmentRepository extends JpaRepository<UserAssignment, UserAssignmentId> {

    List<UserAssignment> findByUserId(UUID userId);

    List<UserAssignment> findByPractitionerId(UUID practitionerId);

    boolean existsByUserIdAndPractitionerId(UUID userId, UUID practitionerId);

    @Modifying
    @Query("DELETE FROM UserAssignment ua WHERE ua.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
