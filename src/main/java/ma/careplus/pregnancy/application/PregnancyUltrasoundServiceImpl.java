package ma.careplus.pregnancy.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.pregnancy.domain.DueDateSource;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyUltrasound;
import ma.careplus.pregnancy.domain.UltrasoundKind;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyUltrasoundRepository;
import ma.careplus.pregnancy.infrastructure.web.dto.RecordUltrasoundRequest;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * PregnancyUltrasoundService implementation — Étape 2.
 *
 * <p>When a T1 datation echo corrects the due date, this service:
 * <ol>
 *   <li>Parses {@code eg} (estimated gestational age in days) from {@code biometryJson}.</li>
 *   <li>Computes {@code newDueDate = performedAt + (280 - eg)}.</li>
 *   <li>Updates {@code pregnancy.dueDate} and {@code pregnancy.dueDateSource = ECHO_T1}.</li>
 *   <li>Calls {@link PregnancyService#recomputePlanVisites} to regenerate the visit plan.</li>
 * </ol>
 *
 * <p>Jackson ObjectMapper is used for minimal JSON field extraction from {@code biometryJson}
 * (avoids adding a separate JSON library dependency; ObjectMapper is already on classpath
 * as Spring Boot's default serializer).
 */
@Service
@Transactional
public class PregnancyUltrasoundServiceImpl implements PregnancyUltrasoundService {

    private final PregnancyRepository pregnancyRepo;
    private final PregnancyUltrasoundRepository ultrasoundRepo;
    private final PregnancyService pregnancyService;
    private final ObjectMapper objectMapper;

    public PregnancyUltrasoundServiceImpl(PregnancyRepository pregnancyRepo,
                                           PregnancyUltrasoundRepository ultrasoundRepo,
                                           PregnancyService pregnancyService,
                                           ObjectMapper objectMapper) {
        this.pregnancyRepo = pregnancyRepo;
        this.ultrasoundRepo = ultrasoundRepo;
        this.pregnancyService = pregnancyService;
        this.objectMapper = objectMapper;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // record
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public PregnancyUltrasound record(UUID pregnancyId, RecordUltrasoundRequest body, UUID actorUserId) {
        Pregnancy pregnancy = pregnancyRepo.findById(pregnancyId)
                .orElseThrow(() -> new NotFoundException("PREGNANCY_NOT_FOUND",
                        "Grossesse introuvable : " + pregnancyId));

        if (body.saWeeksAtExam() < 6) {
            throw new BusinessException("SA_TOO_EARLY",
                    "L'âge gestationnel à l'examen doit être d'au moins 6 SA.", 422);
        }

        PregnancyUltrasound echo = new PregnancyUltrasound();
        echo.setPregnancyId(pregnancyId);
        echo.setKind(body.kind());
        echo.setPerformedAt(body.performedAt());
        echo.setSaWeeksAtExam(body.saWeeksAtExam());
        echo.setSaDaysAtExam(body.saDaysAtExam());
        echo.setFindings(body.findings());
        echo.setDocumentId(body.documentId());
        echo.setBiometryJson(body.biometryJson());
        echo.setCorrectsDueDate(body.correctsDueDate());
        echo.setRecordedBy(actorUserId);
        echo.setCreatedBy(actorUserId);

        PregnancyUltrasound saved = ultrasoundRepo.save(echo);

        // Due-date correction — only for T1 datation with explicit opt-in
        if (body.correctsDueDate() && body.kind() == UltrasoundKind.T1_DATATION) {
            int egDays = extractEgDays(body.biometryJson(), body.saWeeksAtExam(), body.saDaysAtExam());
            LocalDate newDueDate = body.performedAt().plusDays(280 - egDays);

            pregnancy.setDueDate(newDueDate);
            pregnancy.setDueDateSource(DueDateSource.ECHO_T1);
            pregnancy.setUpdatedBy(actorUserId);
            pregnancyRepo.save(pregnancy);

            // Recompute the 8-entry visit plan from the corrected lmpDate
            // (plan uses lmpDate as anchor, not dueDate directly — lmpDate stays unchanged;
            // the plan generator recomputes target_date = lmpDate + sa_target * 7)
            pregnancyService.recomputePlanVisites(pregnancyId, actorUserId);
        }

        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // listByPregnancy
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<PregnancyUltrasound> listByPregnancy(UUID pregnancyId) {
        pregnancyRepo.findById(pregnancyId)
                .orElseThrow(() -> new NotFoundException("PREGNANCY_NOT_FOUND",
                        "Grossesse introuvable : " + pregnancyId));
        return ultrasoundRepo.findByPregnancyIdOrderByPerformedAt(pregnancyId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Extracts the estimated gestational age in days ({@code eg}) from the biometry JSON.
     *
     * <p>Falls back to {@code saWeeksAtExam * 7 + saDaysAtExam} if:
     * <ul>
     *   <li>{@code biometryJson} is null or empty.</li>
     *   <li>The {@code eg} key is absent or not a number.</li>
     *   <li>JSON parsing fails.</li>
     * </ul>
     */
    private int extractEgDays(String biometryJson, short saWeeksAtExam, short saDaysAtExam) {
        int fallback = saWeeksAtExam * 7 + saDaysAtExam;
        if (biometryJson == null || biometryJson.isBlank()) return fallback;
        try {
            Map<String, Object> map = objectMapper.readValue(biometryJson,
                    new TypeReference<Map<String, Object>>() {});
            Object eg = map.get("eg");
            if (eg instanceof Number n) {
                int egDays = n.intValue();
                return egDays > 0 ? egDays : fallback;
            }
        } catch (Exception ignored) {
            // Malformed JSON → fall back to SA-based estimate
        }
        return fallback;
    }
}
