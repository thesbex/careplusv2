package ma.careplus.clinical.application;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.catalog.domain.PrescriptionLine;
import ma.careplus.catalog.infrastructure.persistence.PrescriptionLineRepository;
import ma.careplus.clinical.domain.PrescriptionResultValue;
import ma.careplus.clinical.infrastructure.persistence.PrescriptionResultValueRepository;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * V047 — saisie structurée des résultats LAB / IMAGING et lecture du
 * graphe d'évolution dans le dossier patient.
 *
 * <p>Le mode d'écriture est "bulk replace" : la requête envoie l'ensemble
 * des analytes pour une ligne de prescription, le service efface puis
 * réécrit. Plus simple côté UI que d'individualiser create/update/delete,
 * et le volume par prescription est borné (un NFS = ~10 analytes max).
 */
@Service
@Transactional
public class PrescriptionResultValueService {

    private final PrescriptionResultValueRepository repository;
    private final PrescriptionLineRepository prescriptionLineRepository;
    private final JdbcTemplate jdbc;

    public PrescriptionResultValueService(
            PrescriptionResultValueRepository repository,
            PrescriptionLineRepository prescriptionLineRepository,
            JdbcTemplate jdbc) {
        this.repository = repository;
        this.prescriptionLineRepository = prescriptionLineRepository;
        this.jdbc = jdbc;
    }

    /** Bulk-replace : efface puis ré-insère. Recorded_at = now() côté DB. */
    public List<PrescriptionResultValue> replaceForLine(UUID lineId, List<ValueInput> inputs) {
        PrescriptionLine line = prescriptionLineRepository.findById(lineId)
                .orElseThrow(() -> new BusinessException("PRESCRIPTION_LINE_NOT_FOUND",
                        "Ligne de prescription introuvable.", HttpStatus.NOT_FOUND.value()));
        if (line.getLabTestId() == null && line.getImagingExamId() == null) {
            throw new BusinessException("RESULT_NOT_APPLICABLE",
                    "Un résultat ne peut être attaché qu'à une ligne d'analyse ou d'imagerie.",
                    HttpStatus.BAD_REQUEST.value());
        }

        UUID patientId = jdbc.queryForObject(
                "SELECT patient_id FROM clinical_prescription WHERE id = ?",
                UUID.class, line.getPrescriptionId());

        repository.deleteByPrescriptionLineId(lineId);
        repository.flush();

        OffsetDateTime now = OffsetDateTime.now();
        int order = 0;
        for (ValueInput in : inputs) {
            if (in.analyte() == null || in.analyte().isBlank()) continue;
            if (in.value() == null) continue;
            PrescriptionResultValue v = new PrescriptionResultValue();
            v.setPrescriptionLineId(lineId);
            v.setPatientId(patientId);
            v.setAnalyte(in.analyte().trim());
            v.setValueNumeric(in.value());
            v.setUnit(in.unit() == null || in.unit().isBlank() ? null : in.unit().trim());
            v.setRecordedAt(now);
            v.setSortOrder(order++);
            repository.save(v);
        }
        return repository.findByPrescriptionLineIdOrderBySortOrderAsc(lineId);
    }

    @Transactional(readOnly = true)
    public List<PrescriptionResultValue> listForLine(UUID lineId) {
        return repository.findByPrescriptionLineIdOrderBySortOrderAsc(lineId);
    }

    /**
     * Groupé par analyte normalisé pour le graphe d'évolution. Ordre
     * chronologique à l'intérieur de chaque groupe. La clé Map est le
     * libellé tel que vu par le médecin (premier orthographe rencontré).
     */
    @Transactional(readOnly = true)
    public Map<String, List<PrescriptionResultValue>> trendForPatient(UUID patientId) {
        List<PrescriptionResultValue> all = repository.findByPatientIdOrderByRecordedAtAsc(patientId);
        // Groupage par normalized ; on garde le libellé de la première occurrence
        // chronologique comme label affiché.
        java.util.LinkedHashMap<String, String> displayByKey = new java.util.LinkedHashMap<>();
        java.util.LinkedHashMap<String, List<PrescriptionResultValue>> groups = new java.util.LinkedHashMap<>();
        for (PrescriptionResultValue v : all) {
            String key = v.getAnalyteNormalized();
            if (key == null) continue;
            displayByKey.putIfAbsent(key, v.getAnalyte());
            groups.computeIfAbsent(displayByKey.get(key), k -> new java.util.ArrayList<>()).add(v);
        }
        return groups;
    }

    /** Payload côté service (le contrôleur fait le mapping DTO → ValueInput). */
    public record ValueInput(String analyte, BigDecimal value, String unit) {}
}
