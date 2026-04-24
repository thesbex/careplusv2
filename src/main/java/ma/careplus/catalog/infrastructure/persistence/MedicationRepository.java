package ma.careplus.catalog.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.domain.Medication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MedicationRepository extends JpaRepository<Medication, UUID> {

    /**
     * Trigram-based search on commercial name and DCI (molecule).
     * Uses pg_trgm indexes on catalog_medication (created in V001).
     * Limit 20 for type-ahead performance.
     */
    @Query(value = """
            SELECT * FROM catalog_medication
            WHERE active = TRUE
              AND (commercial_name ILIKE '%' || :q || '%'
                   OR dci ILIKE '%' || :q || '%')
            ORDER BY favorite DESC, commercial_name
            LIMIT 20
            """, nativeQuery = true)
    List<Medication> searchByNameOrDci(@Param("q") String q);
}
