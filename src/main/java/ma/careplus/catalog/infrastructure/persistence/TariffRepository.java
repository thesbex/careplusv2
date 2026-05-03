package ma.careplus.catalog.infrastructure.persistence;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.catalog.domain.Tariff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface TariffRepository extends JpaRepository<Tariff, UUID> {

    List<Tariff> findByActIdOrderByEffectiveFromDesc(UUID actId);

    /**
     * Finds the tariff effective on a given date for a specific act + tier.
     * Returns the row where effectiveFrom <= date AND (effectiveTo IS NULL OR effectiveTo >= date).
     */
    @Query("""
            SELECT t FROM Tariff t
            WHERE t.actId = :actId
              AND t.tier = :tier
              AND t.effectiveFrom <= :date
              AND (t.effectiveTo IS NULL OR t.effectiveTo >= :date)
            ORDER BY t.effectiveFrom DESC
            """)
    Optional<Tariff> findEffectiveTariff(
            @Param("actId") UUID actId,
            @Param("tier") String tier,
            @Param("date") LocalDate date);

    /**
     * Find the currently open (no effectiveTo) tariff for act + tier.
     * Used when adding a new tariff to close the previous one.
     */
    @Query("""
            SELECT t FROM Tariff t
            WHERE t.actId = :actId
              AND t.tier = :tier
              AND t.effectiveTo IS NULL
            ORDER BY t.effectiveFrom DESC
            """)
    List<Tariff> findOpenTariffs(
            @Param("actId") UUID actId,
            @Param("tier") String tier);
}
