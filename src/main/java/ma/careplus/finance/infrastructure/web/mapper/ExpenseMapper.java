package ma.careplus.finance.infrastructure.web.mapper;

import ma.careplus.finance.domain.Expense;
import ma.careplus.finance.infrastructure.web.dto.ExpenseResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper: Expense entity → ExpenseResponse DTO.
 * componentModel = "spring" → Spring bean, injected via constructor.
 */
@Mapper(componentModel = "spring")
public interface ExpenseMapper {

    @Mapping(target = "source", constant = "MANUAL")
    ExpenseResponse toResponse(Expense expense);
}
