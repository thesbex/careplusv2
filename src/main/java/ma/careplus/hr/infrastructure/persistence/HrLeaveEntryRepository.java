package ma.careplus.hr.infrastructure.persistence;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import ma.careplus.hr.domain.HrLeaveEntry;
import ma.careplus.hr.domain.LeaveType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data JPA repository for {@link HrLeaveEntry}.
 */
public interface HrLeaveEntryRepository extends JpaRepository<HrLeaveEntry, UUID> {

    /** All leave entries for a given staff member, most recent first. */
    @Query("SELECT e FROM HrLeaveEntry e WHERE e.staffId = :staffId ORDER BY e.startDate DESC")
    List<HrLeaveEntry> findByStaffId(@Param("staffId") UUID staffId);

    /** Sum of days for a specific type (e.g. CONGE) for a given staff member. */
    @Query("""
            SELECT COALESCE(SUM(e.days), 0)
            FROM HrLeaveEntry e
            WHERE e.staffId = :staffId AND e.type = :type
            """)
    BigDecimal sumDaysByStaffAndType(
            @Param("staffId") UUID staffId,
            @Param("type") LeaveType type);

    /** Count entries of a specific type for a given staff member. */
    @Query("SELECT COUNT(e) FROM HrLeaveEntry e WHERE e.staffId = :staffId AND e.type = :type")
    long countByStaffAndType(
            @Param("staffId") UUID staffId,
            @Param("type") LeaveType type);
}
