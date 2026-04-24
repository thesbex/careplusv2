package ma.careplus.billing.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import ma.careplus.billing.domain.ConfigPatientTier;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConfigPatientTierRepository extends JpaRepository<ConfigPatientTier, UUID> {

    Optional<ConfigPatientTier> findByTier(String tier);
}
