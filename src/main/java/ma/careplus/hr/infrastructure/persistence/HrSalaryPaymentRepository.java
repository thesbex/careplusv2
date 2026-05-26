package ma.careplus.hr.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.hr.domain.HrSalaryPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Spring Data JPA repository for {@link HrSalaryPayment}.
 */
public interface HrSalaryPaymentRepository extends JpaRepository<HrSalaryPayment, UUID> {

    /** All payments for a given staff member, most recent period first. */
    @Query("SELECT p FROM HrSalaryPayment p WHERE p.staffId = :staffId ORDER BY p.period DESC, p.paidAt DESC")
    List<HrSalaryPayment> findByStaffId(@Param("staffId") UUID staffId);
}
