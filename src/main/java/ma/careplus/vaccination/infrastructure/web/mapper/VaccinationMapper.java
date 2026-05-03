package ma.careplus.vaccination.infrastructure.web.mapper;

import ma.careplus.vaccination.domain.VaccineCatalog;
import ma.careplus.vaccination.domain.VaccineScheduleDose;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineCatalogView;
import ma.careplus.vaccination.infrastructure.web.dto.VaccineScheduleDoseView;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * MapStruct mapper for vaccination module DTOs.
 */
@Mapper(componentModel = "spring")
public interface VaccinationMapper {

    @Mapping(target = "isPni", source = "pni")
    VaccineCatalogView toCatalogView(VaccineCatalog entity);

    VaccineScheduleDoseView toScheduleView(VaccineScheduleDose entity);
}
