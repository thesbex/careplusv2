package ma.careplus.finance.infrastructure.web.mapper;

import ma.careplus.finance.domain.Expense;
import ma.careplus.finance.infrastructure.web.dto.ExpenseResponse;
import org.mapstruct.Mapper;

/**
 * MapStruct mapper: Expense entity → ExpenseResponse DTO.
 * componentModel = "spring" → Spring bean, injected via constructor.
 */
@Mapper(componentModel = "spring")
public interface ExpenseMapper {

    ExpenseResponse toResponse(Expense expense);
}
