package ma.careplus.prestation.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.prestation.domain.Prestation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PrestationRepository extends JpaRepository<Prestation, UUID> {

    Optional<Prestation> findByCode(String code);

    @Query("SELECT p FROM Prestation p WHERE p.active = TRUE ORDER BY p.sortOrder, p.label")
    List<Prestation> findActive();

    @Query("SELECT p FROM Prestation p ORDER BY p.sortOrder, p.label")
    List<Prestation> findAllOrdered();
}
