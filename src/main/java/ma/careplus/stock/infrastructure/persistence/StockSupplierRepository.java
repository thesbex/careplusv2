package ma.careplus.stock.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.stock.domain.StockSupplier;
import org.springframework.data.jpa.repository.JpaRepository;

public interface StockSupplierRepository extends JpaRepository<StockSupplier, UUID> {

    List<StockSupplier> findAllByActiveTrueOrderByNameAsc();

    List<StockSupplier> findAllByOrderByNameAsc();

    boolean existsByNameIgnoreCase(String name);
}
