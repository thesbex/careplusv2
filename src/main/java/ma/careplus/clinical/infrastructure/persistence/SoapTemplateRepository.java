package ma.careplus.clinical.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.clinical.domain.SoapTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

/** Modèles SOAP privés au médecin (filtrage par practitioner_id). */
public interface SoapTemplateRepository extends JpaRepository<SoapTemplate, UUID> {

    List<SoapTemplate> findByPractitionerIdAndDeletedAtIsNullOrderByNameAsc(UUID practitionerId);

    Optional<SoapTemplate> findByIdAndPractitionerIdAndDeletedAtIsNull(UUID id, UUID practitionerId);
}
