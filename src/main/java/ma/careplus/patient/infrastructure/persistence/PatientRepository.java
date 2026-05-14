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

    /**
     * Rich list query for the patients screen (05a). Filters: free-text q,
     * gender, age range, and segment (tous / recent / chroniques / nouveaux).
     * Segment semantics:
     *   - recent     → at least one consultation in the last 14 days
     *   - chroniques → at least one antecedent with category PERSONNEL_MALADIES_CHRONIQUES
     *   - nouveaux   → patient created < 30 days ago
     *   - tous (default) → no extra constraint
     *
     * Pass NULL / blank to skip a filter. Native query so we can EXTRACT(YEAR FROM AGE())
     * without dragging Hibernate dialect into the equation.
     */
    @Query(value = """
            SELECT * FROM patient_patient p
            WHERE p.deleted_at IS NULL
              AND (CAST(:q AS TEXT) IS NULL OR :q = '' OR (
                    LOWER(p.last_name)  LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(p.first_name) LIKE LOWER(CONCAT('%', :q, '%'))
                 OR p.phone LIKE CONCAT('%', :q, '%')
                 OR UPPER(p.cin) LIKE UPPER(CONCAT('%', :q, '%'))
              ))
              AND (CAST(:gender AS TEXT) IS NULL OR p.gender = :gender)
              AND (CAST(:ageMin AS INT) IS NULL OR EXTRACT(YEAR FROM AGE(p.birth_date)) >= :ageMin)
              AND (CAST(:ageMax AS INT) IS NULL OR EXTRACT(YEAR FROM AGE(p.birth_date)) <= :ageMax)
              AND (
                    :segment = 'tous'
                 OR (:segment = 'nouveaux'   AND p.created_at > (NOW() - INTERVAL '30 days'))
                 OR (:segment = 'recent'     AND EXISTS (
                                                  SELECT 1 FROM clinical_consultation c
                                                  WHERE c.patient_id = p.id
                                                    AND c.started_at > (NOW() - INTERVAL '14 days')))
                 OR (:segment = 'chroniques' AND EXISTS (
                                                  SELECT 1 FROM patient_antecedent a
                                                  WHERE a.patient_id = p.id
                                                    AND a.category = 'PERSONNEL_MALADIES_CHRONIQUES'))
              )
            ORDER BY p.last_name, p.first_name
            """,
            countQuery = """
            SELECT COUNT(*) FROM patient_patient p
            WHERE p.deleted_at IS NULL
              AND (CAST(:q AS TEXT) IS NULL OR :q = '' OR (
                    LOWER(p.last_name)  LIKE LOWER(CONCAT('%', :q, '%'))
                 OR LOWER(p.first_name) LIKE LOWER(CONCAT('%', :q, '%'))
                 OR p.phone LIKE CONCAT('%', :q, '%')
                 OR UPPER(p.cin) LIKE UPPER(CONCAT('%', :q, '%'))
              ))
              AND (CAST(:gender AS TEXT) IS NULL OR p.gender = :gender)
              AND (CAST(:ageMin AS INT) IS NULL OR EXTRACT(YEAR FROM AGE(p.birth_date)) >= :ageMin)
              AND (CAST(:ageMax AS INT) IS NULL OR EXTRACT(YEAR FROM AGE(p.birth_date)) <= :ageMax)
              AND (
                    :segment = 'tous'
                 OR (:segment = 'nouveaux'   AND p.created_at > (NOW() - INTERVAL '30 days'))
                 OR (:segment = 'recent'     AND EXISTS (
                                                  SELECT 1 FROM clinical_consultation c
                                                  WHERE c.patient_id = p.id
                                                    AND c.started_at > (NOW() - INTERVAL '14 days')))
                 OR (:segment = 'chroniques' AND EXISTS (
                                                  SELECT 1 FROM patient_antecedent a
                                                  WHERE a.patient_id = p.id
                                                    AND a.category = 'PERSONNEL_MALADIES_CHRONIQUES'))
              )
            """,
            nativeQuery = true)
    Page<Patient> listForScreen(
            @Param("q") String q,
            @Param("segment") String segment,
            @Param("gender") String gender,
            @Param("ageMin") Integer ageMin,
            @Param("ageMax") Integer ageMax,
            Pageable pageable);

    /**
     * Batch aggregates for the list rows. For each patient id in {@code ids} we
     * compute, in a single SQL pass, the last consultation start, the next
     * non-cancelled appointment, the chronic-antecedent count + descriptions,
     * the allergy count, and whether an EN_COURS pregnancy exists.
     *
     * Read-only reporting query — crosses module boundaries by design
     * (architectural rule applies to writes / entity wiring; not to a flat
     * list-screen aggregate).
     *
     * Returns native rows: [patient_id, last_visit_at, next_appt_at,
     *   chronic_count, chronic_descriptions(text[] joined as csv via string_agg),
     *   allergy_count, pregnant(boolean)].
     */
    @Query(value = """
            SELECT
              p.id                                                   AS patient_id,
              (SELECT MAX(c.started_at)
                 FROM clinical_consultation c
                WHERE c.patient_id = p.id)                            AS last_visit_at,
              (SELECT MIN(a.start_at)
                 FROM scheduling_appointment a
                WHERE a.patient_id = p.id
                  AND a.start_at > NOW()
                  AND a.status NOT IN ('ANNULE','NO_SHOW'))           AS next_appt_at,
              (SELECT COUNT(*)
                 FROM patient_antecedent ant
                WHERE ant.patient_id = p.id
                  AND ant.category = 'PERSONNEL_MALADIES_CHRONIQUES') AS chronic_count,
              (SELECT STRING_AGG(ant.description, '||' ORDER BY ant.created_at DESC)
                 FROM patient_antecedent ant
                WHERE ant.patient_id = p.id
                  AND ant.category = 'PERSONNEL_MALADIES_CHRONIQUES') AS chronic_tags,
              (SELECT COUNT(*)
                 FROM patient_allergy al
                WHERE al.patient_id = p.id)                           AS allergy_count,
              EXISTS (SELECT 1 FROM pregnancy pg
                       WHERE pg.patient_id = p.id
                         AND pg.status = 'EN_COURS')                  AS pregnant
            FROM patient_patient p
            WHERE p.id IN :ids
            """, nativeQuery = true)
    List<Object[]> findListAggregates(@Param("ids") List<UUID> ids);

    /** Count of patients matching a single segment — used for the segmented-control badges. */
    @Query(value = """
            SELECT COUNT(*) FROM patient_patient p
            WHERE p.deleted_at IS NULL
              AND (
                    :segment = 'tous'
                 OR (:segment = 'nouveaux'   AND p.created_at > (NOW() - INTERVAL '30 days'))
                 OR (:segment = 'recent'     AND EXISTS (
                                                  SELECT 1 FROM clinical_consultation c
                                                  WHERE c.patient_id = p.id
                                                    AND c.started_at > (NOW() - INTERVAL '14 days')))
                 OR (:segment = 'chroniques' AND EXISTS (
                                                  SELECT 1 FROM patient_antecedent a
                                                  WHERE a.patient_id = p.id
                                                    AND a.category = 'PERSONNEL_MALADIES_CHRONIQUES'))
              )
            """,
            nativeQuery = true)
    long countSegment(@Param("segment") String segment);
}
