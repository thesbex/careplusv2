package ma.careplus.scheduling.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AppointmentRepository extends JpaRepository<Appointment, UUID> {

    /**
     * Finds every appointment that overlaps the [from, to) window for a given
     * practitioner, ignoring cancelled + no-show. Used for both listing and
     * conflict detection. `excludedId` allows moving an appointment without
     * considering itself a conflict against itself.
     */
    @Query("""
            SELECT a FROM Appointment a
            WHERE a.practitionerId = :practitionerId
              AND a.status NOT IN (ma.careplus.scheduling.domain.AppointmentStatus.ANNULE,
                                   ma.careplus.scheduling.domain.AppointmentStatus.NO_SHOW)
              AND a.startAt < :to
              AND a.endAt   > :from
              AND (:excludedId IS NULL OR a.id <> :excludedId)
            ORDER BY a.startAt
            """)
    List<Appointment> findOverlapping(
            @Param("practitionerId") UUID practitionerId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to,
            @Param("excludedId") UUID excludedId);

    /** Listing: practitioner's week (or any window). Includes cancellations if status asked for. */
    @Query("""
            SELECT a FROM Appointment a
            WHERE a.practitionerId = :practitionerId
              AND a.startAt >= :from
              AND a.startAt <  :to
            ORDER BY a.startAt
            """)
    List<Appointment> findInWindow(
            @Param("practitionerId") UUID practitionerId,
            @Param("from") OffsetDateTime from,
            @Param("to") OffsetDateTime to);

    List<Appointment> findByPatientIdOrderByStartAtDesc(UUID patientId);

    long countByStatusAndStartAtBetween(AppointmentStatus status, OffsetDateTime from, OffsetDateTime to);
}
