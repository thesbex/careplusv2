package ma.careplus.clinical.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.clinical.domain.PrescriptionTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PrescriptionTemplateRepository extends JpaRepository<PrescriptionTemplate, UUID> {

    @Query("""
            SELECT t FROM PrescriptionTemplate t
            WHERE t.practitionerId = :practitionerId
              AND t.type = :type
              AND t.deletedAt IS NULL
            ORDER BY t.updatedAt DESC
            """)
    List<PrescriptionTemplate> findActiveByPractitionerAndType(UUID practitionerId, String type);

    @Query("""
            SELECT t FROM PrescriptionTemplate t
            WHERE t.id = :id
              AND t.practitionerId = :practitionerId
              AND t.deletedAt IS NULL
            """)
    Optional<PrescriptionTemplate> findActiveByIdAndPractitioner(UUID id, UUID practitionerId);

    @Query("""
            SELECT COUNT(t) > 0 FROM PrescriptionTemplate t
            WHERE t.practitionerId = :practitionerId
              AND t.type = :type
              AND LOWER(t.name) = LOWER(:name)
              AND t.deletedAt IS NULL
              AND (:excludeId IS NULL OR t.id <> :excludeId)
            """)
    boolean existsConflictingName(UUID practitionerId, String type, String name, UUID excludeId);
}
