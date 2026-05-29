package ma.careplus.scheduling.infrastructure.persistence;

import java.util.UUID;
import ma.careplus.scheduling.domain.PractitionerLunchBreak;
import org.springframework.data.jpa.repository.JpaRepository;

/** Pause déjeuner par médecin (PK = practitioner_id → au plus une fenêtre). */
public interface PractitionerLunchBreakRepository
        extends JpaRepository<PractitionerLunchBreak, UUID> {
}
