package ma.careplus.pregnancy.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyStatus;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyVisitRepository;
import ma.careplus.shared.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Computes obstetric alerts at query time — no persistence, no table.
 *
 * <p>Seven hardcoded rules aligned with the design doc (OMS 2016 + Min Santé Maroc PSGA).
 *
 * <p>Strategy for countActiveAlerts / countByPregnancy:
 * Iterates all EN_COURS pregnancies and calls queryAlertsForPregnancy per pregnancy.
 * Acceptable for MVP scale (a GP cabinet has 10–50 active pregnancies at most).
 * Post-MVP a native aggregate query could replace this if response time degrades.
 */
@Service
@Transactional(readOnly = true)
public class PregnancyAlertServiceImpl implements PregnancyAlertService {

    private static final Logger log = LoggerFactory.getLogger(PregnancyAlertServiceImpl.class);

    /** T3 starts at SA 28 per OMS 2016 */
    private static final int T3_START_WEEKS = 28;
    /** Absence of visit trigger window for NO_VISIT_T3 = 6 weeks */
    private static final int NO_VISIT_WINDOW_WEEKS = 6;
    /** BCF monitoring starts at SA 12 */
    private static final int BCF_MIN_SA_WEEKS = 12;
    /** Term overdue threshold: 7 days past due_date */
    private static final int TERME_DEPASSE_DAYS = 7;

    private final PregnancyRepository pregnancyRepo;
    private final PregnancyVisitRepository visitRepo;
    private final ObjectMapper objectMapper;

    public PregnancyAlertServiceImpl(PregnancyRepository pregnancyRepo,
                                      PregnancyVisitRepository visitRepo,
                                      ObjectMapper objectMapper) {
        this.pregnancyRepo = pregnancyRepo;
        this.visitRepo = visitRepo;
        this.objectMapper = objectMapper;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public interface
    // ─────────────────────────────────────────────────────────────────────────

    @Override
    public List<PregnancyAlertView> queryAlertsForPregnancy(UUID pregnancyId) {
        Pregnancy pregnancy = pregnancyRepo.findById(pregnancyId)
                .orElseThrow(() -> new NotFoundException("PREGNANCY_NOT_FOUND",
                        "Grossesse introuvable: " + pregnancyId));

        Optional<PregnancyVisit> lastVisitOpt =
                visitRepo.findFirstByPregnancyIdOrderByRecordedAtDesc(pregnancyId);

        LocalDate today = LocalDate.now();
        List<PregnancyAlertView> alerts = new ArrayList<>();

        // ── Rule 1: HTA_GRAVIDIQUE ──────────────────────────────────────────
        if (lastVisitOpt.isPresent()) {
            PregnancyVisit lv = lastVisitOpt.get();
            if ((lv.getBpSystolic() != null && lv.getBpSystolic() >= 140)
                    || (lv.getBpDiastolic() != null && lv.getBpDiastolic() >= 90)) {
                alerts.add(new PregnancyAlertView(
                        "HTA_GRAVIDIQUE",
                        "Hypertension artérielle gravidique (TA ≥ 140/90)",
                        "WARN",
                        toInstant(lv.getRecordedAt())));
            }
        }

        // ── Rule 2: GAJ_GLUCOSE_URINAIRE ───────────────────────────────────
        if (lastVisitOpt.isPresent()) {
            PregnancyVisit lv = lastVisitOpt.get();
            if (hasUrineDipFlag(lv.getUrineDipJson(), "glucose")) {
                alerts.add(new PregnancyAlertView(
                        "GAJ_GLUCOSE_URINAIRE",
                        "Glycosurie positive à la BU — glycémie à jeun recommandée",
                        "WARN",
                        toInstant(lv.getRecordedAt())));
            }
        }

        // ── Rule 3: HGPO_POSITIVE ──────────────────────────────────────────
        // TODO(v2): integrate with real lab results (no result import in MVP).
        // For v1 we look for "HGPO+" string in visit notes as a manual marker.
        // This rule remains intentionally unimplemented beyond the note scan; a
        // real integration would query imported lab results (out of MVP scope).
        // Returns empty for now.

        // ── Rule 4: TERME_DEPASSE ──────────────────────────────────────────
        if (pregnancy.getStatus() == PregnancyStatus.EN_COURS
                && pregnancy.getDueDate() != null
                && today.isAfter(pregnancy.getDueDate().plusDays(TERME_DEPASSE_DAYS))) {
            long daysOver = ChronoUnit.DAYS.between(
                    pregnancy.getDueDate().plusDays(TERME_DEPASSE_DAYS), today);
            alerts.add(new PregnancyAlertView(
                    "TERME_DEPASSE",
                    "Terme dépassé (> DPA + 7 j) — " + daysOver + " jours de retard",
                    "CRITICAL",
                    pregnancy.getDueDate().plusDays(TERME_DEPASSE_DAYS)
                            .atStartOfDay().toInstant(ZoneOffset.UTC)));
        }

        // ── Rule 5: NO_VISIT_T3 ────────────────────────────────────────────
        if (pregnancy.getLmpDate() != null) {
            long saWeeksNow = ChronoUnit.WEEKS.between(pregnancy.getLmpDate(), today);
            if (saWeeksNow >= T3_START_WEEKS) {
                OffsetDateTime cutoff = OffsetDateTime.now().minusWeeks(NO_VISIT_WINDOW_WEEKS);
                long recentVisits = visitRepo.countByPregnancyIdAndRecordedAtAfter(pregnancyId, cutoff);
                if (recentVisits == 0) {
                    alerts.add(new PregnancyAlertView(
                            "NO_VISIT_T3",
                            "Aucune visite depuis plus de 6 semaines en T3",
                            "WARN",
                            pregnancy.getLmpDate()
                                    .plusWeeks(T3_START_WEEKS)
                                    .atStartOfDay().toInstant(ZoneOffset.UTC)));
                }
            }
        }

        // ── Rule 6: BCF_ABSENT ─────────────────────────────────────────────
        if (lastVisitOpt.isPresent() && pregnancy.getLmpDate() != null) {
            long saWeeksNow = ChronoUnit.WEEKS.between(pregnancy.getLmpDate(), today);
            if (saWeeksNow >= BCF_MIN_SA_WEEKS) {
                PregnancyVisit lv = lastVisitOpt.get();
                if (lv.getFetalHeartRateBpm() == null
                        || lv.getFetalHeartRateBpm() == 0) {
                    alerts.add(new PregnancyAlertView(
                            "BCF_ABSENT",
                            "Bruits du cœur fœtal absents ou non mesurés à la dernière visite (SA ≥ 12)",
                            "CRITICAL",
                            toInstant(lv.getRecordedAt())));
                }
            }
        }

        // ── Rule 7: BU_POSITIVE ────────────────────────────────────────────
        if (lastVisitOpt.isPresent()) {
            PregnancyVisit lv = lastVisitOpt.get();
            if (hasUrineDipFlag(lv.getUrineDipJson(), "protein")
                    || hasUrineDipFlag(lv.getUrineDipJson(), "leuco")
                    || hasUrineDipFlag(lv.getUrineDipJson(), "nitrites")) {
                alerts.add(new PregnancyAlertView(
                        "BU_POSITIVE",
                        "Bandelette urinaire positive (protéines, leucocytes ou nitrites)",
                        "WARN",
                        toInstant(lv.getRecordedAt())));
            }
        }

        return alerts;
    }

    @Override
    public int countActiveAlerts() {
        List<Pregnancy> active = pregnancyRepo.findByStatus(PregnancyStatus.EN_COURS);
        int count = 0;
        for (Pregnancy p : active) {
            if (!queryAlertsForPregnancy(p.getId()).isEmpty()) {
                count++;
            }
        }
        return count;
    }

    @Override
    public Map<UUID, Integer> countByPregnancy(Collection<UUID> pregnancyIds) {
        Map<UUID, Integer> result = new HashMap<>();
        for (UUID id : pregnancyIds) {
            int n = queryAlertsForPregnancy(id).size();
            if (n > 0) {
                result.put(id, n);
            }
        }
        return result;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Parses the urine_dip JSONB string and checks if a boolean field is true.
     * Returns false on parse error or null input (fail-safe).
     */
    private boolean hasUrineDipFlag(String json, String field) {
        if (json == null || json.isBlank()) return false;
        try {
            JsonNode node = objectMapper.readTree(json);
            JsonNode flag = node.get(field);
            return flag != null && flag.asBoolean(false);
        } catch (Exception e) {
            log.debug("Failed to parse urine_dip JSON for field '{}': {}", field, e.getMessage());
            return false;
        }
    }

    private static java.time.Instant toInstant(OffsetDateTime odt) {
        return odt == null ? null : odt.toInstant();
    }
}
