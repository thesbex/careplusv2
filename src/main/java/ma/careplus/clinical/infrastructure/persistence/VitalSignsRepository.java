package ma.careplus.clinical.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.clinical.domain.VitalSigns;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VitalSignsRepository extends JpaRepository<VitalSigns, UUID> {
    List<VitalSigns> findByPatientIdOrderByRecordedAtDesc(UUID patientId);
    List<VitalSigns> findByAppointmentIdOrderByRecordedAtDesc(UUID appointmentId);

    /**
     * Lie les constantes saisies en salle d'attente (avant que la consultation
     * n'existe) à la consultation qui vient d'être démarrée pour ce rendez-vous.
     * Sans cette liaison, l'écran consultation filtre par consultationId et
     * n'affiche rien — voir bug 2026-05-02.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("""
            UPDATE VitalSigns v
               SET v.consultationId = :consultationId
             WHERE v.appointmentId = :appointmentId
               AND v.consultationId IS NULL
            """)
    int linkUnlinkedToConsultation(@Param("appointmentId") UUID appointmentId,
                                   @Param("consultationId") UUID consultationId);
}
