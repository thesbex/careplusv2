package ma.careplus.identity.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import ma.careplus.identity.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    @Modifying
    @Query("UPDATE User u SET u.failedAttempts = u.failedAttempts + 1 WHERE u.id = :id")
    void incrementFailedAttempts(@Param("id") UUID id);

    @Modifying
    @Query("UPDATE User u SET u.failedAttempts = 0, u.lockedUntil = null WHERE u.id = :id")
    void resetFailedAttempts(@Param("id") UUID id);
}
