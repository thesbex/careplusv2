package ma.careplus.pregnancy.application;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.identity.application.AccessScopeService;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.pregnancy.application.PregnancyAlertService.PregnancyAlertView;
import ma.careplus.pregnancy.domain.Pregnancy;
import ma.careplus.pregnancy.domain.PregnancyStatus;
import ma.careplus.pregnancy.domain.PregnancyVisit;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyVisitRepository;
import ma.careplus.vaccination.infrastructure.web.dto.PageView;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pregnancy worklist — Étape 3.
 *
 * <p>Loads all EN_COURS pregnancies, joins with Patient for name data,
 * computes SA + trimester + last visit timestamp, then applies filters and paginates
 * in-memory. Acceptable at MVP scale (GP cabinet: max 50 active pregnancies).
 *
 * <p>Cross-module read on PatientRepository: accepted exception, same precedent as
 * VaccinationQueueServiceImpl, BillingService, CatalogService.
 *
 * <p>V039 — practitionerId scoping is now applied via {@link AccessScopeService},
 * symétrique à V036 vaccination. Quand le cloisonnement (V032) est activé, on
 * dérive pour chaque grossesse le set des practitioners qui ont au moins une
 * fois agi (declaration via pregnancy.created_by, visite via
 * pregnancy_visit.recorded_by ou created_by, écho via
 * pregnancy_ultrasound.recorded_by ou created_by, plan via
 * pregnancy_visit_plan.created_by) et on ne garde que les grossesses dont ce
 * set chevauche le scope du caller. Les grossesses orphelines (jamais touchées
 * par personne) sont visibles si le rôle du caller est dans
 * configuration_clinic_settings.pregnancy_orphan_visible_roles.
 */
@Service
@Transactional(readOnly = true)
public class PregnancyQueueServiceImpl implements PregnancyQueueService {

    private static final Logger log = LoggerFactory.getLogger(PregnancyQueueServiceImpl.class);

    private final PregnancyRepository pregnancyRepo;
    private final PregnancyVisitRepository visitRepo;
    private final PatientRepository patientRepo;
    private final PregnancyAlertService alertService;
    private final AccessScopeService accessScope;
    private final JdbcTemplate jdbc;

    public PregnancyQueueServiceImpl(PregnancyRepository pregnancyRepo,
                                      PregnancyVisitRepository visitRepo,
                                      PatientRepository patientRepo,
                                      PregnancyAlertService alertService,
                                      AccessScopeService accessScope,
                                      JdbcTemplate jdbc) {
        this.pregnancyRepo = pregnancyRepo;
        this.visitRepo = visitRepo;
        this.patientRepo = patientRepo;
        this.alertService = alertService;
        this.accessScope = accessScope;
        this.jdbc = jdbc;
    }

    @Override
    public PageView<PregnancyQueueEntry> queue(QueueFilters filters, Authentication auth) {
        LocalDate today = LocalDate.now();

        // 1. Load all active pregnancies
        List<Pregnancy> active = pregnancyRepo.findByStatus(PregnancyStatus.EN_COURS);

        // ── V039 — Cloisonnement ────────────────────────────────────────────
        // Si scope est vide (Optional.empty) : pas de filtrage (ADMIN, isolation
        // OFF, ou cabinet à 1 médecin). Sinon : on filtre grossesse par grossesse.
        Optional<Set<UUID>> scopeOpt = accessScope.allowedPractitioners(auth);
        boolean enforceScope = scopeOpt.isPresent();
        Set<UUID> allowedPractitioners = scopeOpt.orElse(Set.of());
        Set<String> orphanRoles = enforceScope
                ? new HashSet<>(readPregnancyOrphanVisibleRoles())
                : Set.of();
        boolean callerCanSeeOrphans = enforceScope
                && extractRoleCodes(auth).stream().anyMatch(orphanRoles::contains);

        // Pré-charge la map (pregnancy_id → set des practitioners ayant agi).
        // Une seule requête bulk au lieu de N. UNION ALL des 4 sources puis
        // dédup en mémoire.
        Map<UUID, Set<UUID>> pregnancyPractitioners = enforceScope
                ? loadPractitionersForPregnancies(active.stream().map(Pregnancy::getId).toList())
                : Map.of();

        // 2. Build entries
        List<PregnancyQueueEntry> entries = new ArrayList<>();

        for (Pregnancy p : active) {
            // V039 — Cloisonnement : filtre grossesse avant le calcul SA + alertes.
            if (enforceScope) {
                Set<UUID> rattaches = pregnancyPractitioners.getOrDefault(p.getId(), Set.of());
                if (rattaches.isEmpty()) {
                    if (!callerCanSeeOrphans) continue;
                } else {
                    if (Collections.disjoint(rattaches, allowedPractitioners)) continue;
                }
            }

            // Load patient
            Optional<Patient> patientOpt = patientRepo.findById(p.getPatientId());
            if (patientOpt.isEmpty()) continue; // Orphan row — skip

            Patient patient = patientOpt.get();

            // Name search filter (case-insensitive, partial)
            if (filters.q() != null && !filters.q().isBlank()) {
                String q = filters.q().toLowerCase();
                boolean matches =
                        (patient.getLastName() != null && patient.getLastName().toLowerCase().contains(q))
                        || (patient.getFirstName() != null && patient.getFirstName().toLowerCase().contains(q));
                if (!matches) continue;
            }

            // Compute SA — semaines + jours dans la semaine courante (frontend affiche "Xs+Yj")
            int totalDays = (int) ChronoUnit.DAYS.between(p.getLmpDate(), today);
            int saWeeks = totalDays / 7;
            int saDays = Math.floorMod(totalDays, 7);
            String trimester = computeTrimester(saWeeks);

            // Trimester filter
            if (filters.trimester() != null && !filters.trimester().equalsIgnoreCase(trimester)) continue;

            // Last visit timestamp
            Optional<PregnancyVisit> lastVisit =
                    visitRepo.findFirstByPregnancyIdOrderByRecordedAtDesc(p.getId());
            java.time.Instant lastVisitAt = lastVisit.map(v -> v.getRecordedAt().toInstant()).orElse(null);

            // Alerts (full list — frontend lit entry.alerts.length pour le badge + détail au hover)
            // N+1 acceptable au scope MVP (max ~50 grossesses actives par cabinet GP).
            List<PregnancyAlertView> alerts = alertService.queryAlertsForPregnancy(p.getId());

            // withAlerts filter
            if (Boolean.TRUE.equals(filters.withAlerts()) && alerts.isEmpty()) continue;

            entries.add(new PregnancyQueueEntry(
                    p.getId(),
                    p.getPatientId(),
                    patient.getLastName(),
                    patient.getFirstName(),
                    p.getLmpDate(),
                    p.getDueDate(),
                    saWeeks,
                    saDays,
                    trimester,
                    lastVisitAt,
                    alerts
            ));
        }

        // 3. Sort by SA descending (most advanced first)
        entries.sort(Comparator.comparingInt(PregnancyQueueEntry::saWeeks).reversed());

        // 4. Paginate
        int page = filters.resolvedPage();
        int size = filters.resolvedSize();
        long total = entries.size();

        int fromIndex = page * size;
        int toIndex = (int) Math.min(fromIndex + size, total);

        List<PregnancyQueueEntry> pageContent = fromIndex >= total
                ? List.of()
                : entries.subList(fromIndex, toIndex);

        return PageView.of(pageContent, total, page, size);
    }

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * T1 < 14 weeks, T2 14–27 weeks, T3 ≥ 28 weeks.
     * Negative saWeeks (LMP in future) → T1.
     */
    private static String computeTrimester(int saWeeks) {
        if (saWeeks < 14)  return "T1";
        if (saWeeks < 28)  return "T2";
        return "T3";
    }

    // ─── V039 helpers : cloisonnement grossesse ──────────────────────────────

    /**
     * Pour la liste de pregnancy_ids fournie, retourne pour chacun le set des
     * practitioner_ids qui ont au moins une fois agi (déclaration, visite,
     * écho ou plan de visite). Grossesses orphelines absentes de la map.
     * Une seule requête bulk via UNION ALL des 4 sources.
     */
    private Map<UUID, Set<UUID>> loadPractitionersForPregnancies(List<UUID> pregnancyIds) {
        if (pregnancyIds == null || pregnancyIds.isEmpty()) return Map.of();
        String sql = """
                SELECT pregnancy_id, practitioner_id FROM (
                  SELECT pr.id AS pregnancy_id, pr.created_by AS practitioner_id
                    FROM pregnancy pr
                    WHERE pr.id = ANY(?) AND pr.created_by IS NOT NULL
                  UNION ALL
                  SELECT pv.pregnancy_id, COALESCE(pv.recorded_by, pv.created_by)
                    FROM pregnancy_visit pv
                    WHERE pv.pregnancy_id = ANY(?)
                      AND COALESCE(pv.recorded_by, pv.created_by) IS NOT NULL
                  UNION ALL
                  SELECT pu.pregnancy_id, COALESCE(pu.recorded_by, pu.created_by)
                    FROM pregnancy_ultrasound pu
                    WHERE pu.pregnancy_id = ANY(?)
                      AND COALESCE(pu.recorded_by, pu.created_by) IS NOT NULL
                  UNION ALL
                  SELECT pvp.pregnancy_id, pvp.created_by
                    FROM pregnancy_visit_plan pvp
                    WHERE pvp.pregnancy_id = ANY(?)
                      AND pvp.created_by IS NOT NULL
                ) src
                """;
        Map<UUID, Set<UUID>> out = new HashMap<>();
        UUID[] arr = pregnancyIds.toArray(UUID[]::new);
        jdbc.query(connection -> {
            var ps = connection.prepareStatement(sql);
            ps.setArray(1, connection.createArrayOf("uuid", arr));
            ps.setArray(2, connection.createArrayOf("uuid", arr));
            ps.setArray(3, connection.createArrayOf("uuid", arr));
            ps.setArray(4, connection.createArrayOf("uuid", arr));
            return ps;
        }, rs -> {
            UUID pregId = (UUID) rs.getObject("pregnancy_id");
            UUID practitionerId = (UUID) rs.getObject("practitioner_id");
            out.computeIfAbsent(pregId, k -> new HashSet<>()).add(practitionerId);
        });
        return out;
    }

    /**
     * Lit la liste des codes de rôle autorisés à voir les grossesses orphelines
     * (configuration_clinic_settings.pregnancy_orphan_visible_roles).
     * Retourne la liste par défaut (tous les rôles) si la table est vide ou la
     * colonne NULL.
     */
    private List<String> readPregnancyOrphanVisibleRoles() {
        try {
            return jdbc.queryForObject(
                    "SELECT pregnancy_orphan_visible_roles FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        java.sql.Array arr = rs.getArray("pregnancy_orphan_visible_roles");
                        if (arr == null) return defaultOrphanRoles();
                        Object raw = arr.getArray();
                        if (raw instanceof String[] strs) return List.of(strs);
                        return defaultOrphanRoles();
                    });
        } catch (EmptyResultDataAccessException e) {
            return defaultOrphanRoles();
        }
    }

    private static List<String> defaultOrphanRoles() {
        return List.of("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT");
    }

    /** Extracts {@code MEDECIN}/{@code ADMIN}/etc. from {@code ROLE_*} authorities. */
    private static Set<String> extractRoleCodes(Authentication auth) {
        if (auth == null) return Set.of();
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a)
                .collect(Collectors.toUnmodifiableSet());
    }
}
