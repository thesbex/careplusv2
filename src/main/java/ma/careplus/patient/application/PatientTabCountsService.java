package ma.careplus.patient.application;

import java.util.UUID;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.patient.infrastructure.web.dto.PatientTabCountsView;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Compteurs des onglets du dossier patient (bug B6).
 *
 * <p>Une seule requête SQL fait un COUNT(*) pour chaque table pertinente.
 * Évite l'aller-retour N+1 que produirait l'appel de chaque endpoint
 * module-par-module, et chaque sous-COUNT s'appuie sur un index existant
 * sur {@code patient_id} :
 *  <ul>
 *    <li>{@code idx_consult_patient} (V001)</li>
 *    <li>{@code idx_prescription_patient} (V029, créé pour ce fix)</li>
 *    <li>{@code idx_invoice_patient} (V001)</li>
 *    <li>{@code idx_patient_document_patient} (V009, partial deleted_at IS NULL)</li>
 *    <li>{@code idx_vaccination_dose_patient_active} (V022, partial deleted_at IS NULL)</li>
 *    <li>{@code idx_pregnancy_patient_id} (V026)</li>
 *  </ul>
 *
 * <p>Cross-module via {@link JdbcTemplate} plutôt qu'inter-modules JPA —
 * pattern aligné sur les autres lectures cross-aggregate (ex.
 * {@code PregnancyBioPanelService} qui lit {@code catalog_lab_test}).
 */
@Service
@Transactional(readOnly = true)
public class PatientTabCountsService {

    private final JdbcTemplate jdbc;
    private final PatientRepository patientRepository;

    public PatientTabCountsService(JdbcTemplate jdbc, PatientRepository patientRepository) {
        this.jdbc = jdbc;
        this.patientRepository = patientRepository;
    }

    /**
     * Renvoie les compteurs pour le dossier patient.
     *
     * @throws NotFoundException si le patient n'existe pas ou est soft-deleted.
     */
    public PatientTabCountsView countsFor(UUID patientId) {
        // Guard : 404 si le patient n'existe pas / est soft-deleted.
        patientRepository.findActiveById(patientId)
                .orElseThrow(() -> new NotFoundException(
                        "PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        // Une seule requête : huit sous-COUNT. Postgres exécute chacun comme
        // un index-only scan sur (patient_id), zero-row materialization.
        String sql = """
                SELECT
                  (SELECT COUNT(*) FROM clinical_consultation
                     WHERE patient_id = ?)                                           AS consultations,
                  (SELECT COUNT(*) FROM clinical_prescription
                     WHERE patient_id = ?)                                           AS prescriptions,
                  (SELECT COUNT(*) FROM patient_document
                     WHERE patient_id = ?
                       AND deleted_at IS NULL
                       AND type = 'ANALYSE')                                         AS analyses,
                  (SELECT COUNT(*) FROM patient_document
                     WHERE patient_id = ?
                       AND deleted_at IS NULL
                       AND type = 'IMAGERIE')                                        AS imagerie,
                  (SELECT COUNT(*) FROM patient_document
                     WHERE patient_id = ?
                       AND deleted_at IS NULL
                       AND type NOT IN ('PHOTO'))                                    AS documents,
                  (SELECT COUNT(*) FROM billing_invoice
                     WHERE patient_id = ?)                                           AS facturation,
                  (SELECT COUNT(*) FROM vaccination_dose
                     WHERE patient_id = ?
                       AND deleted_at IS NULL)                                       AS vaccinations,
                  (SELECT COUNT(*) FROM pregnancy
                     WHERE patient_id = ?)                                           AS grossesses
                """;

        return jdbc.queryForObject(sql,
                (rs, rowNum) -> new PatientTabCountsView(
                        rs.getLong("consultations"),
                        rs.getLong("prescriptions"),
                        rs.getLong("analyses"),
                        rs.getLong("imagerie"),
                        rs.getLong("documents"),
                        rs.getLong("facturation"),
                        rs.getLong("vaccinations"),
                        rs.getLong("grossesses")
                ),
                patientId, patientId, patientId, patientId,
                patientId, patientId, patientId, patientId);
    }
}
