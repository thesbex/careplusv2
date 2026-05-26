package ma.careplus.hr.infrastructure.web.mapper;

import ma.careplus.hr.domain.HrLeaveEntry;
import ma.careplus.hr.domain.HrSalaryPayment;
import ma.careplus.hr.domain.HrStaff;
import ma.careplus.hr.infrastructure.web.dto.LeaveEntryResponse;
import ma.careplus.hr.infrastructure.web.dto.SalaryPaymentResponse;
import ma.careplus.hr.infrastructure.web.dto.StaffResponse;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for the HR module.
 * componentModel = "spring" → injected as a Spring bean.
 */
@Mapper(componentModel = "spring")
public interface HrMapper {

    /** Maps HrStaff entity to StaffResponse DTO. */
    @Mapping(target = "role", expression = "java(staff.getRole().name())")
    StaffResponse toStaffResponse(HrStaff staff);

    /** Maps HrLeaveEntry entity to LeaveEntryResponse DTO. */
    @Mapping(target = "type", expression = "java(entry.getType().name())")
    LeaveEntryResponse toLeaveEntryResponse(HrLeaveEntry entry);

    /** Maps HrSalaryPayment entity to SalaryPaymentResponse DTO. */
    SalaryPaymentResponse toSalaryPaymentResponse(HrSalaryPayment payment);
}
