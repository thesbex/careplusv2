package ma.careplus.rooms.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.rooms.domain.ClinicRoom;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClinicRoomRepository extends JpaRepository<ClinicRoom, UUID> {

    /** All active rooms ordered alphabetically — default listing. */
    List<ClinicRoom> findAllByActiveTrueOrderByNameAsc();

    /** Lookup by id restricted to active rooms. */
    Optional<ClinicRoom> findByIdAndActiveTrue(UUID id);

    /** Existence check used for uniqueness validation (case-insensitive via JPQL). */
    boolean existsByNameIgnoreCaseAndActiveTrue(String name);
}
