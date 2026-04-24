package ma.careplus.scheduling.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.scheduling.domain.AppointmentReason;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AppointmentReasonRepository extends JpaRepository<AppointmentReason, UUID> {
    Optional<AppointmentReason> findByCode(String code);
    List<AppointmentReason> findByActiveTrueOrderByLabel();
}
