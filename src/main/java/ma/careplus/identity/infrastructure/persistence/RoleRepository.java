package ma.careplus.identity.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import ma.careplus.identity.domain.Role;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    Optional<Role> findByCode(String code);
}
