package ma.careplus.patient.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.patient.domain.Patient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatientRepository extends JpaRepository<Patient, UUID> {

    /** Active (non-soft-deleted) patient lookup by id. */
    @Query("SELECT p FROM Patient p WHERE p.id = :id AND p.deletedAt IS NULL")
    Optional<Patient> findActiveById(@Param("id") UUID id);

    /** CIN uniqueness check among non-deleted patients. */
    @Query("SELECT COUNT(p) FROM Patient p WHERE UPPER(p.cin) = UPPER(:cin) AND p.deletedAt IS NULL")
    long countByCinIgnoreCase(@Param("cin") String cin);

    /**
     * Active patient search across last_name, first_name, phone, cin using
     * pg_trgm for fuzzy name matches (indexes from V001 do the heavy lift).
     * The JPQL-native split lets us leverage the GIN trigram indexes for
     * name fields and the btree indexes for phone/cin.
     */
    @Query(value = """
            SELECT * FROM patient_patient p
            WHERE p.deleted_at IS NULL
              AND (
                    LOWER(p.last_name)  LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(p.first_name) LIKE LOWER(CONCAT('%', :q, '%'))
                 OR p.phone LIKE CONCAT('%', :q, '%')
                 OR UPPER(p.cin) LIKE UPPER(CONCAT('%', :q, '%'))
              )
            ORDER BY p.last_name, p.first_name
            """,
            countQuery = """
            SELECT COUNT(*) FROM patient_patient p
            WHERE p.deleted_at IS NULL
              AND (
                    LOWER(p.last_name)  LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(p.first_name) LIKE LOWER(CONCAT('%', :q, '%'))
                 OR p.phone LIKE CONCAT('%', :q, '%')
                 OR UPPER(p.cin) LIKE UPPER(CONCAT('%', :q, '%'))
              )
            """,
            nativeQuery = true)
    Page<Patient> search(@Param("q") String q, Pageable pageable);

    /** All active patients (no filter) — pagable listing. */
    @Query("SELECT p FROM Patient p WHERE p.deletedAt IS NULL ORDER BY p.lastName, p.firstName")
    Page<Patient> findAllActive(Pageable pageable);

    /** Batch active-existence check used by callers that hold a list of ids. */
    @Query("SELECT p.id FROM Patient p WHERE p.id IN :ids AND p.deletedAt IS NULL")
    List<UUID> findActiveIdsIn(@Param("ids") List<UUID> ids);
}
