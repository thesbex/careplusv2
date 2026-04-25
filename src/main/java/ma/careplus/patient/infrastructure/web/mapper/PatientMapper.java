package ma.careplus.patient.infrastructure.web.mapper;

import java.util.List;
import ma.careplus.patient.domain.Allergy;
import ma.careplus.patient.domain.Antecedent;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.web.dto.AllergyView;
import ma.careplus.patient.infrastructure.web.dto.AntecedentView;
import ma.careplus.patient.infrastructure.web.dto.PatientSummary;
import ma.careplus.patient.infrastructure.web.dto.PatientView;
import org.springframework.stereotype.Component;

/**
 * Domain → DTO mapping. Hand-written rather than MapStruct — these mappers
 * are trivial, and explicit > generated for a ~10-field record. Keeps the
 * build fast and the stack-traces readable.
 */
@Component
public class PatientMapper {

    public PatientView toView(Patient p, List<Allergy> allergies, List<Antecedent> antecedents) {
        return new PatientView(
                p.getId(),
                p.getFirstName(),
                p.getLastName(),
                p.getGender(),
                p.getBirthDate(),
                p.getCin(),
                p.getPhone(),
                p.getEmergencyPhone(),
                p.getEmail(),
                p.getAddress(),
                p.getCity(),
                p.getCountry(),
                p.getMaritalStatus(),
                p.getProfession(),
                p.getBloodGroup(),
                p.getNumberChildren(),
                p.getNotes(),
                p.getStatus().name(),
                p.getTier(),
                p.getMutuelleInsuranceId(),
                p.getMutuellePoliceNumber(),
                p.getCreatedAt(),
                p.getUpdatedAt(),
                allergies.stream().map(this::toAllergyView).toList(),
                antecedents.stream().map(this::toAntecedentView).toList());
    }

    public PatientSummary toSummary(Patient p) {
        return new PatientSummary(
                p.getId(),
                p.getFirstName(),
                p.getLastName(),
                p.getGender(),
                p.getBirthDate(),
                p.getCin(),
                p.getPhone(),
                p.getCity(),
                p.getStatus().name(),
                p.getTier());
    }

    public AllergyView toAllergyView(Allergy a) {
        return new AllergyView(
                a.getId(),
                a.getSubstance(),
                a.getAtcTag(),
                a.getSeverity().name(),
                a.getNotes());
    }

    public AntecedentView toAntecedentView(Antecedent a) {
        return new AntecedentView(
                a.getId(),
                a.getType().name(),
                a.getDescription(),
                a.getOccurredOn(),
                a.getCategory() != null ? a.getCategory().name() : null);
    }
}
