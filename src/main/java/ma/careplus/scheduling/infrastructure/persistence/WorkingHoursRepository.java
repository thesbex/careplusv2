package ma.careplus.scheduling.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.scheduling.domain.WorkingHours;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkingHoursRepository extends JpaRepository<WorkingHours, UUID> {
    List<WorkingHours> findByDayOfWeekAndActiveTrue(int dayOfWeek);
    List<WorkingHours> findByActiveTrueOrderByDayOfWeekAscStartTimeAsc();
}
