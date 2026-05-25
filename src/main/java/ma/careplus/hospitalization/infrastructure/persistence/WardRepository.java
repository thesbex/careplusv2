package ma.careplus.hospitalization.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.domain.Ward;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WardRepository extends JpaRepository<Ward, UUID> {

    List<Ward> findAllByActiveTrueOrderByLabelFrAsc();

    boolean existsByCodeIgnoreCaseAndActiveTrue(String code);
}
