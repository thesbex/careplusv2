package ma.careplus.scheduling.infrastructure.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.scheduling.domain.PractitionerLeave;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PractitionerLeaveRepository extends JpaRepository<PractitionerLeave, UUID> {

    /** True if the practitioner has a leave period that covers the given date. */
    @Query("""
            SELECT CASE WHEN COUNT(l) > 0 THEN true ELSE false END
            FROM PractitionerLeave l
            WHERE l.practitionerId = :practitionerId
              AND l.startDate <= :date
              AND l.endDate   >= :date
            """)
    boolean existsActiveOnDate(@Param("practitionerId") UUID practitionerId,
                               @Param("date") LocalDate date);

    List<PractitionerLeave> findByPractitionerIdOrderByStartDateAsc(UUID practitionerId);
}
