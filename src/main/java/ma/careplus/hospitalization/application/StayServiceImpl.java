package ma.careplus.hospitalization.application;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.billing.application.BillingService;
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
import ma.careplus.hospitalization.infrastructure.persistence.StayRepository;
import ma.careplus.hospitalization.infrastructure.persistence.WardRepository;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView.AssignmentView;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView.ChargeLine;
import ma.careplus.hospitalization.infrastructure.web.dto.StayQueueEntry;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.AdmitRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.DischargeRequest;
import ma.careplus.hospitalization.infrastructure.web.dto.StayRequests.TransferRequest;
import ma.careplus.patient.application.PatientService;
import ma.careplus.patient.domain.Patient;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
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
    private final PatientService patientService;
    private final BillingService billingService;

    public StayServiceImpl(StayRepository stayRepo, BedAssignmentRepository assignmentRepo,
                           BedRepository bedRepo, RoomRepository roomRepo, WardRepository wardRepo,
                           PatientService patientService, BillingService billingService) {
        this.stayRepo = stayRepo;
        this.assignmentRepo = assignmentRepo;
        this.bedRepo = bedRepo;
        this.roomRepo = roomRepo;
        this.wardRepo = wardRepo;
        this.patientService = patientService;
        this.billingService = billingService;
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
        List<InvoiceLineRequest> lines = new ArrayList<>();
        for (BedAssignment a : assignmentRepo.findAllByStayIdOrderByFromAtAsc(stayId)) {
            int nights = nights(a.getFromAt(), a.getToAt() != null ? a.getToAt() : Instant.now());
            if (a.getDailyRateAmount().compareTo(BigDecimal.ZERO) <= 0) continue;
            BedCtx b = resolveBedQuiet(a.getBedId());
            String desc = "Hébergement " + (b != null ? b.label : "lit")
                    + (b != null ? " (" + roomClassLabel(b.roomClass) + ")" : "")
                    + " — " + nights + " nuit" + (nights > 1 ? "s" : "");
            lines.add(new InvoiceLineRequest(null, desc, a.getDailyRateAmount(), BigDecimal.valueOf(nights)));
        }
        if (lines.isEmpty()) {
            throw new BusinessException("STAY_NO_CHARGES",
                    "Aucun montant facturable (prix de journée à 0).", 422);
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
    public List<StayQueueEntry> listActive() {
        List<StayQueueEntry> out = new ArrayList<>();
        for (Stay stay : stayRepo.findAllByStatusAndDeletedAtIsNullOrderByAdmittedAtDesc("EN_COURS")) {
            Patient p = patientService.getActive(stay.getPatientId());
            BedAssignment current = assignmentRepo.findByStayIdAndToAtIsNull(stay.getId()).orElse(null);
            BedCtx bed = current != null ? resolveBedQuiet(current.getBedId()) : null;
            out.add(new StayQueueEntry(
                    stay.getId(), stay.getPatientId(), p.getFirstName(), p.getLastName(),
                    stay.getAdmissionReason(), stay.getAdmittedAt(),
                    nights(stay.getAdmittedAt(), Instant.now()),
                    bed != null ? bed.label : null,
                    bed != null ? bed.wardLabel : null,
                    stay.getAttendingPractitionerId()));
        }
        return out;
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
        Instant end = stay.getDischargedAt() != null ? stay.getDischargedAt() : Instant.now();
        for (BedAssignment a : assignmentRepo.findAllByStayIdOrderByFromAtAsc(stayId)) {
            Instant to = a.getToAt() != null ? a.getToAt() : end;
            int nights = nights(a.getFromAt(), to);
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
        return new StayDetailView(
                stay.getId(), stay.getPatientId(), p.getFirstName(), p.getLastName(),
                stay.getStatus(), stay.getAdmissionReason(), stay.getAttendingPractitionerId(),
                stay.getAdmittedAt(), stay.getDischargedAt(), stay.getDischargeType(),
                stay.getDischargeSummary(), stay.getInvoiceId(),
                assignments, charges, total);
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

    /** Nombre de nuits (règle NUITS, min 1) entre deux instants. */
    private static int nights(Instant from, Instant to) {
        if (from == null || to == null) return 1;
        long days = Duration.between(from, to).toDays();
        return (int) Math.max(1, days);
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
