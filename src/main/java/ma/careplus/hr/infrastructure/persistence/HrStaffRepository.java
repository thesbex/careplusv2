package ma.careplus.hr.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.hr.domain.HrStaff;
import ma.careplus.hr.domain.StaffRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data JPA repository for {@link HrStaff}.
 * All queries exclude soft-deleted rows (deleted_at IS NULL) unless stated otherwise.
 */
public interface HrStaffRepository extends JpaRepository<HrStaff, UUID> {

    /** Find non-deleted staff member by id. */
    @Query("SELECT s FROM HrStaff s WHERE s.id = :id AND s.deletedAt IS NULL")
    Optional<HrStaff> findActiveById(@Param("id") UUID id);

    /**
     * List non-deleted staff with optional filters on active flag and role.
     * Both parameters are nullable — null means "no filter on that column".
     */
    @Query("""
            SELECT s FROM HrStaff s
            WHERE s.deletedAt IS NULL
              AND (:active IS NULL OR s.active = :active)
              AND (:role   IS NULL OR s.role   = :role)
            ORDER BY s.fullName ASC
            """)
    List<HrStaff> findAllActive(
            @Param("active") Boolean active,
            @Param("role")   StaffRole role);
}
