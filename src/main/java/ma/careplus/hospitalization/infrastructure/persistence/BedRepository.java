package ma.careplus.hospitalization.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.domain.Bed;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BedRepository extends JpaRepository<Bed, UUID> {

    List<Bed> findAllByActiveTrueOrderByCodeAsc();

    List<Bed> findAllByRoomIdAndActiveTrueOrderByCodeAsc(UUID roomId);

    boolean existsByRoomIdAndCodeIgnoreCaseAndActiveTrue(UUID roomId, String code);

    boolean existsByRoomIdAndActiveTrue(UUID roomId);
}
