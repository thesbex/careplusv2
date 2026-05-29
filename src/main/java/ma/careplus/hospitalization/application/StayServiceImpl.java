package ma.careplus.hospitalization.application;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import ma.careplus.billing.application.BillingService;
import ma.careplus.identity.application.AccessScopeService;
import ma.careplus.billing.domain.Invoice;
import ma.careplus.billing.infrastructure.web.dto.InvoiceLineRequest;
import ma.careplus.hospitalization.domain.Bed;
import ma.careplus.hospitalization.domain.BedAssignment;
import ma.careplus.hospitalization.domain.Room;
import ma.careplus.hospitalization.domain.Stay;
import ma.careplus.hospitalization.domain.Ward;
import ma.careplus.hospitalization.infrastructure.persistence.BedAssignmentRepository;
import ma.careplus.hospitalization.infrastructure.persistence.BedRepository;
import ma.careplus.hospitalization.infrastructure.persistence.RoomRepository;
import ma.careplus.hospitalization.infrastructure.persistence.StayPrestationRepository;
import ma.careplus.hospitalization.infrastructure.persistence.StayRepository;
import ma.careplus.hospitalization.infrastructure.persistence.WardRepository;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView.AssignmentView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView.ChargeLine;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView.PrestationLine;
import ma.careplus.hospitalization.infrastructure.web.dto.StayQueueEntry;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.AdmitRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.DischargeRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.TransferRequest;
import ma.careplus.patient.application.PatientService;
import ma.careplus.patient.domain.Patient;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class StayServiceImpl implements StayService {

    private final StayRepository stayRepo;
    private final BedAssignmentRepository assignmentRepo;
    private final BedRepository bedRepo;
    private final RoomRepository roomRepo;
    private final WardRepository wardRepo;
    private final StayPrestationRepository prestationRepo;
    private final PatientService patientService;
    private final BillingService billingService;
    private final AccessScopeService accessScope;
    private final JdbcTemplate jdbc;

    public StayServiceImpl(StayRepository stayRepo, BedAssignmentRepository assignmentRepo,
                           BedRepository bedRepo, RoomRepository roomRepo, WardRepository wardRepo,
                           StayPrestationRepository prestationRepo,
                           PatientService patientService, BillingService billingService,
                           AccessScopeService accessScope, JdbcTemplate jdbc) {
        this.stayRepo = stayRepo;
        this.assignmentRepo = assignmentRepo;
        this.bedRepo = bedRepo;
        this.roomRepo = roomRepo;
        this.wardRepo = wardRepo;
        this.prestationRepo = prestationRepo;
        this.patientService = patientService;
        this.billingService = billingService;
        this.accessScope = accessScope;
        this.jdbc = jdbc;
    }

    // ── Commands ───────────────────────────────────────────────────────

    @Override
    public StayDetailView admit(AdmitRequest req, UUID actorId) {
        patientService.getActive(req.patientId()); // 404 si patient inconnu
        if (stayRepo.existsByPatientIdAndStatusAndDeletedAtIsNull(req.patientId(), "EN_COURS")) {
            throw new BusinessException("PATIENT_ALREADY_ADMITTED",
                    "Ce patient a déjà un séjour en cours.", 409);
        }
        BedCtx bed = resolveAvailableBed(req.bedId());

        Stay stay = new Stay();
        stay.setPatientId(req.patientId());
        stay.setAttendingPractitionerId(req.attendingPractitionerId());
        stay.setAdmittedBy(actorId);
        stay.setAdmissionReason(req.admissionReason());
        stay.setStatus("EN_COURS");
        stay.setAdmittedAt(Instant.now());
        stay.setCreatedBy(actorId);
        stay = stayRepo.save(stay);

        openAssignment(stay.getId(), bed, actorId);
        return get(stay.getId());
    }

    @Override
    public StayDetailView transfer(UUID stayId, TransferRequest req, UUID actorId) {
        Stay stay = loadActive(stayId);
        BedAssignment current = assignmentRepo.findByStayIdAndToAtIsNull(stayId).orElse(null);
        if (current != null && current.getBedId().equals(req.bedId())) {
            throw new BusinessException("SAME_BED", "Le patient est déjà dans ce lit.", 409);
        }
        BedCtx bed = resolveAvailableBed(req.bedId());
        Instant now = Instant.now();
        if (current != null) {
            current.setToAt(now);
        }
        openAssignment(stayId, bed, actorId);
        stay.setUpdatedBy(actorId);
        return get(stayId);
    }

    @Override
    public StayDetailView discharge(UUID stayId, DischargeRequest req, UUID actorId) {
        Stay stay = loadActive(stayId);
        Instant now = Instant.now();
        assignmentRepo.findByStayIdAndToAtIsNull(stayId).ifPresent(a -> a.setToAt(now));
        stay.setStatus("SORTI");
        stay.setDischargedAt(now);
        stay.setDischargeType(req.dischargeType());
        stay.setDischargeSummary(req.dischargeSummary());
        stay.setUpdatedBy(actorId);
        return get(stayId);
    }

    @Override
    public void cancel(UUID stayId, UUID actorId) {
        Stay stay = loadActive(stayId);
        assignmentRepo.findByStayIdAndToAtIsNull(stayId).ifPresent(a -> a.setToAt(Instant.now()));
        stay.setStatus("ANNULE");
        stay.setUpdatedBy(actorId);
    }

    @Override
    public UUID generateInvoice(UUID stayId, UUID actorId) {
        Stay stay = stayRepo.findByIdAndDeletedAtIsNull(stayId)
                .orElseThrow(() -> new NotFoundException("STAY_NOT_FOUND", "Séjour introuvable : " + stayId));
        if (!"SORTI".equals(stay.getStatus())) {
            throw new BusinessException("STAY_NOT_DISCHARGED",
                    "Le séjour doit être en sortie (SORTI) avant facturation. Statut : " + stay.getStatus(), 409);
        }
        String rule = dayRule();
        List<InvoiceLineRequest> lines = new ArrayList<>();
        for (BedAssignment a : assignmentRepo.findAllByStayIdOrderByFromAtAsc(stayId)) {
            int nights = nights(a.getFromAt(), a.getToAt() != null ? a.getToAt() : Instant.now(), rule);
            if (a.getDailyRateAmount().compareTo(BigDecimal.ZERO) <= 0) continue;
            BedCtx b = resolveBedQuiet(a.getBedId());
            String desc = "Hébergement " + (b != null ? b.label : "lit")
                    + (b != null ? " (" + roomClassLabel(b.roomClass) + ")" : "")
                    + " — " + nights + " nuit" + (nights > 1 ? "s" : "");
            lines.add(new InvoiceLineRequest(null, desc, a.getDailyRateAmount(), BigDecimal.valueOf(nights)));
        }
        // Append prestation lines (actes/services supplémentaires en sus du prix de journée)
        for (ma.careplus.hospitalization.domain.StayPrestation sp :
                prestationRepo.findAllByStayIdOrderByPerformedAtAsc(stayId)) {
            lines.add(new InvoiceLineRequest(sp.getActId(), sp.getLabel(),
                    sp.getUnitPrice(), sp.getQuantity()));
        }

        // QA10-4 : englober les consultations effectuées pendant le séjour. On absorbe
        // les factures BROUILLON de consultation du patient dont la consultation tombe
        // dans la fenêtre du séjour [admittedAt, dischargedAt|now]. Leurs lignes (acte +
        // labo/imagerie internes + médicaments internes) sont fusionnées dans la facture
        // de séjour, et les brouillons absorbés sont supprimés (pas de double comptage).
        // Les factures déjà ÉMISES sont laissées intactes (immuables) — voir log billing.
        java.time.OffsetDateTime windowStart = stay.getAdmittedAt().atOffset(java.time.ZoneOffset.UTC);
        java.time.OffsetDateTime windowEnd =
                (stay.getDischargedAt() != null ? stay.getDischargedAt() : Instant.now())
                        .atOffset(java.time.ZoneOffset.UTC);
        lines.addAll(billingService.absorbConsultationDrafts(
                stay.getPatientId(), windowStart, windowEnd));

        if (lines.isEmpty()) {
            throw new BusinessException("STAY_NO_CHARGES",
                    "Aucun montant facturable (prix de journée à 0 et aucune prestation).", 422);
        }
        Invoice invoice = billingService.createStayInvoice(stay.getPatientId(), lines, actorId);
        stay.setInvoiceId(invoice.getId());
        stay.setStatus("FACTURE");
        stay.setUpdatedBy(actorId);
        return invoice.getId();
    }

    // ── Queries ────────────────────────────────────────────────────────

    @Override
    @Transactional(readOnly = true)
    public List<StayQueueEntry> listActive(Authentication auth) {
        // Cloisonnement (Slice E) : si l'isolation stricte est active, un médecin ne
        // voit que SES séjours (attending_practitioner_id) ; les séjours sans référent
        // (orphelins) restent visibles aux rôles configurés. Calque ADR-032.
        Optional<Set<UUID>> scopeOpt = accessScope.allowedPractitioners(auth);
        boolean enforce = scopeOpt.isPresent();
        Set<UUID> allowed = scopeOpt.orElse(Set.of());
        Set<String> orphanRoles = enforce ? new HashSet<>(readHospOrphanRoles()) : Set.of();
        boolean callerSeesOrphans = enforce && callerRoles(auth).stream().anyMatch(orphanRoles::contains);

        String rule = dayRule();
        List<StayQueueEntry> out = new ArrayList<>();
        for (Stay stay : stayRepo.findAllByStatusAndDeletedAtIsNullOrderByAdmittedAtDesc("EN_COURS")) {
            if (enforce) {
                UUID att = stay.getAttendingPractitionerId();
                boolean visible = (att != null && allowed.contains(att)) || (att == null && callerSeesOrphans);
                if (!visible) continue;
            }
            Patient p = patientService.getActive(stay.getPatientId());
            BedAssignment current = assignmentRepo.findByStayIdAndToAtIsNull(stay.getId()).orElse(null);
            BedCtx bed = current != null ? resolveBedQuiet(current.getBedId()) : null;
            out.add(new StayQueueEntry(
                    stay.getId(), stay.getPatientId(), p.getFirstName(), p.getLastName(),
                    stay.getAdmissionReason(), stay.getAdmittedAt(),
                    nights(stay.getAdmittedAt(), Instant.now(), rule),
                    current != null ? current.getBedId() : null,
                    bed != null ? bed.label : null,
                    bed != null ? bed.wardLabel : null,
                    stay.getAttendingPractitionerId()));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public List<StayDetailView> listForPatient(UUID patientId) {
        return stayRepo.findAllByPatientIdAndDeletedAtIsNullOrderByAdmittedAtDesc(patientId).stream()
                .map(s -> get(s.getId()))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public long countActive() {
        return stayRepo.countByStatusAndDeletedAtIsNull("EN_COURS");
    }

    @Override
    @Transactional(readOnly = true)
    public StayDetailView get(UUID stayId) {
        Stay stay = stayRepo.findByIdAndDeletedAtIsNull(stayId)
                .orElseThrow(() -> new NotFoundException("STAY_NOT_FOUND", "Séjour introuvable : " + stayId));
        Patient p = patientService.getActive(stay.getPatientId());

        List<AssignmentView> assignments = new ArrayList<>();
        List<ChargeLine> charges = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        String rule = dayRule();
        Instant end = stay.getDischargedAt() != null ? stay.getDischargedAt() : Instant.now();
        for (BedAssignment a : assignmentRepo.findAllByStayIdOrderByFromAtAsc(stayId)) {
            Instant to = a.getToAt() != null ? a.getToAt() : end;
            int nights = nights(a.getFromAt(), to, rule);
            BedCtx b = resolveBedQuiet(a.getBedId());
            assignments.add(new AssignmentView(a.getId(), a.getBedId(),
                    b != null ? b.label : null, b != null ? b.wardLabel : null,
                    a.getDailyRateAmount(), a.getFromAt(), a.getToAt(), nights));
            if (a.getDailyRateAmount().compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal lineTotal = a.getDailyRateAmount().multiply(BigDecimal.valueOf(nights));
                charges.add(new ChargeLine(
                        "Hébergement " + (b != null ? b.label : "lit"),
                        a.getDailyRateAmount(), nights, lineTotal));
                total = total.add(lineTotal);
            }
        }

        // Prestations (actes/services supplémentaires)
        List<PrestationLine> prestationLines = new ArrayList<>();
        BigDecimal prestationsTotal = BigDecimal.ZERO;
        for (ma.careplus.hospitalization.domain.StayPrestation sp :
                prestationRepo.findAllByStayIdOrderByPerformedAtAsc(stayId)) {
            BigDecimal qty = sp.getQuantity() != null ? sp.getQuantity() : BigDecimal.ONE;
            BigDecimal lineTotal = sp.getUnitPrice().multiply(qty);
            prestationLines.add(new PrestationLine(sp.getId(), sp.getActId(), sp.getLabel(),
                    sp.getUnitPrice(), qty, lineTotal));
            prestationsTotal = prestationsTotal.add(lineTotal);
        }

        return new StayDetailView(
                stay.getId(), stay.getPatientId(), p.getFirstName(), p.getLastName(),
                stay.getStatus(), stay.getAdmissionReason(), stay.getAttendingPractitionerId(),
                stay.getAdmittedAt(), stay.getDischargedAt(), stay.getDischargeType(),
                stay.getDischargeSummary(), stay.getInvoiceId(),
                assignments, charges, total, prestationLines, prestationsTotal);
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private Stay loadActive(UUID stayId) {
        Stay stay = stayRepo.findByIdAndDeletedAtIsNull(stayId)
                .orElseThrow(() -> new NotFoundException("STAY_NOT_FOUND", "Séjour introuvable : " + stayId));
        if (!"EN_COURS".equals(stay.getStatus())) {
            throw new BusinessException("STAY_NOT_ACTIVE",
                    "Action impossible : le séjour n'est pas en cours (statut " + stay.getStatus() + ").", 409);
        }
        return stay;
    }

    /** Résout un lit disponible (existe, actif, ni hors-service/nettoyage, ni déjà occupé). */
    private BedCtx resolveAvailableBed(UUID bedId) {
        Bed bed = bedRepo.findById(bedId)
                .orElseThrow(() -> new NotFoundException("BED_NOT_FOUND", "Lit introuvable : " + bedId));
        if (!bed.isActive()) {
            throw new BusinessException("BED_INACTIVE", "Ce lit est désactivé.", 409);
        }
        if ("HORS_SERVICE".equals(bed.getStatus()) || "NETTOYAGE".equals(bed.getStatus())) {
            throw new BusinessException("BED_UNAVAILABLE",
                    "Ce lit n'est pas disponible (" + bed.getStatus() + ").", 409);
        }
        if (assignmentRepo.findByBedIdAndToAtIsNull(bedId).isPresent()) {
            throw new BusinessException("BED_OCCUPIED", "Ce lit est déjà occupé.", 409);
        }
        return toCtx(bed);
    }

    private void openAssignment(UUID stayId, BedCtx bed, UUID actorId) {
        BedAssignment a = new BedAssignment();
        a.setStayId(stayId);
        a.setBedId(bed.bedId);
        a.setDailyRateAmount(bed.dailyRate);
        a.setFromAt(Instant.now());
        a.setAssignedBy(actorId);
        assignmentRepo.save(a);
    }

    private BedCtx resolveBedQuiet(UUID bedId) {
        return bedRepo.findById(bedId).map(this::toCtx).orElse(null);
    }

    private BedCtx toCtx(Bed bed) {
        Room room = roomRepo.findById(bed.getRoomId()).orElse(null);
        Ward ward = room != null ? wardRepo.findById(room.getWardId()).orElse(null) : null;
        String label = (room != null ? room.getLabelFr() + " · " : "") + bed.getCode();
        BigDecimal rate = room != null ? room.getDailyRate() : BigDecimal.ZERO;
        String roomClass = room != null ? room.getRoomClass() : null;
        String wardLabel = ward != null ? ward.getLabelFr() : null;
        return new BedCtx(bed.getId(), label, wardLabel, rate, roomClass);
    }

    /**
     * Nombre de journées facturables (min 1) selon la règle cabinet (D2) :
     * NUITS = nuits passées (floor des jours) ; JOURS_ENTAMES = jour d'entrée ET
     * de sortie comptés (floor + 1).
     */
    private static int nights(Instant from, Instant to, String rule) {
        if (from == null || to == null) return 1;
        long days = Duration.between(from, to).toDays();
        if ("JOURS_ENTAMES".equals(rule)) {
            return (int) Math.max(1, days + 1);
        }
        return (int) Math.max(1, days);
    }

    /** Règle de comptage des journées (config cabinet, défaut NUITS). */
    private String dayRule() {
        try {
            String r = jdbc.queryForObject(
                    "SELECT stay_billing_day_rule FROM configuration_clinic_settings LIMIT 1", String.class);
            return r != null ? r : "NUITS";
        } catch (EmptyResultDataAccessException e) {
            return "NUITS";
        }
    }

    /** Rôles autorisés à voir les séjours orphelins (config, défaut tous). */
    private List<String> readHospOrphanRoles() {
        try {
            return jdbc.queryForObject(
                    "SELECT hospitalization_orphan_visible_roles FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        java.sql.Array arr = rs.getArray(1);
                        if (arr == null) return List.<String>of();
                        Object raw = arr.getArray();
                        return raw instanceof String[] s ? List.of(s) : List.<String>of();
                    });
        } catch (EmptyResultDataAccessException e) {
            return List.of("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT");
        }
    }

    private static Set<String> callerRoles(Authentication auth) {
        if (auth == null) return Set.of();
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a)
                .collect(Collectors.toSet());
    }

    private static String roomClassLabel(String roomClass) {
        if (roomClass == null) return "—";
        return switch (roomClass) {
            case "INDIVIDUELLE" -> "Individuelle";
            case "DOUBLE" -> "Double";
            case "COMMUNE" -> "Commune";
            case "SUITE" -> "Suite";
            default -> roomClass;
        };
    }

    /** Contexte résolu d'un lit (label, ward, prix de journée, classe). */
    private record BedCtx(UUID bedId, String label, String wardLabel, BigDecimal dailyRate, String roomClass) {}
}
