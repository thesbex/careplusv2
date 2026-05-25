package ma.careplus.hospitalization.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.hospitalization.domain.Room;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RoomRepository extends JpaRepository<Room, UUID> {

    List<Room> findAllByActiveTrueOrderByCodeAsc();

    List<Room> findAllByWardIdAndActiveTrueOrderByCodeAsc(UUID wardId);

    boolean existsByCodeIgnoreCaseAndActiveTrue(String code);

    boolean existsByWardIdAndActiveTrue(UUID wardId);
}
