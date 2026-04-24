package ma.careplus.scheduling.infrastructure.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.scheduling.domain.Holiday;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HolidayRepository extends JpaRepository<Holiday, UUID> {
    Optional<Holiday> findByDate(LocalDate date);
    List<Holiday> findByDateBetweenOrderByDateAsc(LocalDate from, LocalDate to);
}
