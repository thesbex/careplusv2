package ma.careplus.stock.infrastructure.web.mapper;

import ma.careplus.stock.domain.StockArticle;
import ma.careplus.stock.domain.StockSupplier;
import ma.careplus.stock.infrastructure.web.dto.StockArticleView;
import ma.careplus.stock.infrastructure.web.dto.StockSupplierView;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for stock module DTOs.
 */
@Mapper(componentModel = "spring")
public interface StockMapper {

    StockSupplierView toSupplierView(StockSupplier entity);

    /**
     * Maps StockArticle to StockArticleView.
     * supplierName and currentQuantity are not on the entity — they must be
     * set by the service layer after mapping via enrichment or a dedicated factory method.
     * We ignore them here and let the service call toArticleView(entity, supplierName, currentQty).
     */
    @Mapping(target = "supplierName", ignore = true)
    @Mapping(target = "currentQuantity", ignore = true)
    StockArticleView toArticleView(StockArticle entity);
}
