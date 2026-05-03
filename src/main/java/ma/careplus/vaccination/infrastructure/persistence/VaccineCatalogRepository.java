package ma.careplus.vaccination.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.vaccination.domain.VaccineCatalog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VaccineCatalogRepository extends JpaRepository<VaccineCatalog, UUID> {

    List<VaccineCatalog> findAllByActiveTrue();

    Optional<VaccineCatalog> findByCode(String code);

    boolean existsByCode(String code);
}
