package ma.careplus.catalog.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.domain.Act;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ActRepository extends JpaRepository<Act, UUID> {

    List<Act> findAllByActiveTrue();
}
