package ma.careplus.pregnancy.infrastructure.web.mapper;

import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyUltrasound;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import ma.careplus.pregnancy.domain.PregnancyVisitPlan;
import ma.careplus.pregnancy.infrastructure.web.dto.PregnancyView;
import ma.careplus.pregnancy.infrastructure.web.dto.PregnancyVisitPlanView;
import ma.careplus.pregnancy.infrastructure.web.dto.PregnancyVisitView;
import ma.careplus.pregnancy.infrastructure.web.dto.UltrasoundView;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for pregnancy module DTOs.
 *
 * <p>Computed fields (saWeeks, gravidity, parity) are NOT derived here — they require
 * data beyond the entity (today's date, aggregate counts). The controller builds a
 * dedicated helper record and passes values directly; this mapper handles the
 * structural entity → DTO projection only.
 *
 * <p>Use {@code toView(entity, saWeeks, gravidity, parity)} from the controller.
 */
@Mapper(componentModel = "spring")
public interface PregnancyMapper {

    @Mapping(target = "saWeeks",   expression = "java(saWeeks)")
    @Mapping(target = "gravidity", expression = "java(gravidity)")
    @Mapping(target = "parity",    expression = "java(parity)")
    PregnancyView toView(Pregnancy entity,
                          Integer saWeeks,
                          int gravidity,
                          int parity);

    PregnancyVisitPlanView toPlanView(PregnancyVisitPlan entity);

    @Mapping(target = "urineDipJson", source = "urineDipJson")
    PregnancyVisitView toVisitView(PregnancyVisit entity);

    @Mapping(target = "biometryJson", source = "biometryJson")
    UltrasoundView toUltrasoundView(PregnancyUltrasound entity);
}
