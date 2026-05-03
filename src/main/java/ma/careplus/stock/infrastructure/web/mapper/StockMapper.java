package ma.careplus.stock.infrastructure.web.mapper;

import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockSupplier;
import ma.careplus.stock.infrastructure.web.dto.StockArticleView;
import ma.careplus.stock.infrastructure.web.dto.StockSupplierView;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for stock module DTOs.
 * StockMovementView and StockLotView are built directly (not via MapStruct)
 * because they require resolved user name and computed daysUntilExpiry.
 */
@Mapper(componentModel = "spring")
public interface StockMapper {

    StockSupplierView toSupplierView(StockSupplier entity);

    /**
     * Maps StockArticle to StockArticleView.
     * supplierName, currentQuantity, and nearestExpiry are not on the entity —
     * they must be set by the controller via enrichment.
     */
    @Mapping(target = "supplierName", ignore = true)
    @Mapping(target = "currentQuantity", ignore = true)
    @Mapping(target = "nearestExpiry", ignore = true)
    StockArticleView toArticleView(StockArticle entity);
}
