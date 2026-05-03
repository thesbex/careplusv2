package ma.careplus.billing.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import ma.careplus.billing.domain.ConfigPatientTier;
import ma.careplus.billing.domain.CreditNote;
import ma.careplus.billing.domain.Invoice;
import ma.careplus.billing.domain.InvoiceLine;
import ma.careplus.billing.domain.InvoiceStatus;
import ma.careplus.billing.domain.Payment;
import ma.careplus.billing.infrastructure.persistence.ConfigPatientTierRepository;
import ma.careplus.billing.infrastructure.persistence.CreditNoteRepository;
import ma.careplus.billing.infrastructure.persistence.InvoiceLineRepository;
import ma.careplus.billing.infrastructure.persistence.InvoiceRepository;
import ma.careplus.billing.infrastructure.persistence.InvoiceSequenceRepository;
import ma.careplus.billing.infrastructure.persistence.PaymentRepository;
import ma.careplus.billing.domain.PaymentMode;
import ma.careplus.billing.infrastructure.web.dto.AdjustTotalRequest;
import ma.careplus.billing.infrastructure.web.dto.CreditNoteResponse;
import ma.careplus.billing.infrastructure.web.dto.InvoiceLineRequest;
import ma.careplus.billing.infrastructure.web.dto.InvoiceListRow;
import ma.careplus.billing.infrastructure.web.dto.InvoiceSearchResponse;
import ma.careplus.billing.infrastructure.web.dto.InvoiceUpdateRequest;
import ma.careplus.billing.infrastructure.web.dto.IssueInvoiceResponse;
import ma.careplus.billing.infrastructure.web.dto.PaymentResponse;
import ma.careplus.billing.infrastructure.web.dto.RecordPaymentRequest;
import ma.careplus.catalog.application.CatalogService;
import ma.careplus.catalog.domain.Act;
import ma.careplus.catalog.domain.Tariff;
import ma.careplus.catalog.infrastructure.persistence.ActRepository;
import ma.careplus.clinical.domain.ConsultationSigneeEvent;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.prestation.domain.ConsultationPrestation;
import ma.careplus.prestation.domain.Prestation;
import ma.careplus.prestation.infrastructure.persistence.ConsultationPrestationRepository;
import ma.careplus.prestation.infrastructure.persistence.PrestationRepository;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.infrastructure.persistence.AppointmentRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Billing service: invoice lifecycle, sequential numbering, payments, credit notes.
 *
 * The {@link #onConsultationSigned(ConsultationSigneeEvent)} listener receives events
 * from the clinical module after a consultation is signed. It runs in AFTER_COMMIT phase
 * in a REQUIRES_NEW transaction (the original consultation transaction is already committed).
 *
 * Sequential number assignment uses SELECT FOR UPDATE on billing_invoice_sequence
 * to prevent gaps and races under concurrent issuance (ADR-011).
 */
@Service
public class BillingService {

    private static final Logger log = LoggerFactory.getLogger(BillingService.class);

    private final InvoiceRepository invoiceRepository;
    private final InvoiceLineRepository invoiceLineRepository;
    private final PaymentRepository paymentRepository;
    private final CreditNoteRepository creditNoteRepository;
    private final ConfigPatientTierRepository tierRepository;
    private final InvoiceSequenceRepository sequenceRepository;
    private final PatientRepository patientRepository;
    private final AppointmentRepository appointmentRepository;
    private final ActRepository actRepository;
    private final CatalogService catalogService;
    private final ConsultationPrestationRepository consultationPrestationRepository;
    private final PrestationRepository prestationRepository;
    private final JdbcTemplate jdbc;

    public BillingService(InvoiceRepository invoiceRepository,
                          InvoiceLineRepository invoiceLineRepository,
                          PaymentRepository paymentRepository,
                          CreditNoteRepository creditNoteRepository,
                          ConfigPatientTierRepository tierRepository,
                          InvoiceSequenceRepository sequenceRepository,
                          PatientRepository patientRepository,
                          AppointmentRepository appointmentRepository,
                          ActRepository actRepository,
                          CatalogService catalogService,
                          ConsultationPrestationRepository consultationPrestationRepository,
                          PrestationRepository prestationRepository,
                          JdbcTemplate jdbc) {
        this.invoiceRepository = invoiceRepository;
        this.invoiceLineRepository = invoiceLineRepository;
        this.paymentRepository = paymentRepository;
        this.creditNoteRepository = creditNoteRepository;
        this.tierRepository = tierRepository;
        this.sequenceRepository = sequenceRepository;
        this.patientRepository = patientRepository;
        this.appointmentRepository = appointmentRepository;
        this.actRepository = actRepository;
        this.catalogService = catalogService;
        this.consultationPrestationRepository = consultationPrestationRepository;
        this.prestationRepository = prestationRepository;
        this.jdbc = jdbc;
    }

    // ── Event listener: creates draft invoice when consultation is signed ─────

    /**
     * AFTER_COMMIT listener. The consultation transaction is done; we open a NEW
     * transaction to create the draft invoice. If this fails, the consultation is
     * still signed — we log the error. A retry mechanism is out of scope for MVP.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onConsultationSigned(ConsultationSigneeEvent event) {
        try {
            // Idempotency guard: skip if invoice already exists for this consultation
            if (invoiceRepository.findByConsultationId(event.consultationId()).isPresent()) {
                log.debug("Invoice already exists for consultation {}, skipping", event.consultationId());
                return;
            }

            // Load patient to get tier + mutuelle info
            Patient patient = patientRepository.findById(event.patientId()).orElse(null);
            if (patient == null) {
                log.error("Patient {} not found when creating invoice for consultation {}",
                        event.patientId(), event.consultationId());
                return;
            }

            String tier = patient.getTier() != null ? patient.getTier() : "NORMAL";

            // Step 1: Save the invoice header first to get a persistent ID
            Invoice invoice = new Invoice();
            invoice.setPatientId(event.patientId());
            invoice.setConsultationId(event.consultationId());
            invoice.setAppointmentId(event.appointmentId());
            invoice.setStatus(InvoiceStatus.BROUILLON);
            invoice.setMutuelleInsuranceId(patient.getMutuelleInsuranceId());
            invoice.setMutuellePoliceNumber(patient.getMutuellePoliceNumber());
            invoice.setTotalAmount(BigDecimal.ZERO);
            invoice.setDiscountAmount(BigDecimal.ZERO);
            invoice.setNetAmount(BigDecimal.ZERO);
            invoice = invoiceRepository.save(invoice);

            // Step 2: Resolve the consultation line.
            // Order de résolution :
            //  1) Le motif RDV référence un default_act_id avec un tarif effectif
            //     pour la tier du patient → on l'utilise (cas normal).
            //  2) Sinon (ex. consultation hors agenda, motif sans default_act,
            //     pas de tarif catalogué pour la tier) → on cherche le premier
            //     acte de type CONSULTATION actif et on prend son tarif (ou
            //     defaultPrice à défaut). On NE laisse JAMAIS la ligne
            //     consultation absente — sinon le médecin se retrouve avec une
            //     facture qui n'a que les prestations, ce qui surprend
            //     (rapport Y. Boutaleb 2026-05-01).
            BigDecimal totalAmount = BigDecimal.ZERO;
            int position = 0;
            UUID resolvedActId = null;
            BigDecimal resolvedAmount = null;
            if (event.appointmentId() != null) {
                Optional<Appointment> apptOpt = appointmentRepository.findById(event.appointmentId());
                if (apptOpt.isPresent()) {
                    UUID defaultActId = resolveDefaultActId(apptOpt.get());
                    if (defaultActId != null) {
                        Optional<Tariff> tariff = catalogService.getEffectiveTariff(
                                defaultActId, tier, event.signedAt().toLocalDate());
                        if (tariff.isPresent()) {
                            resolvedActId = defaultActId;
                            resolvedAmount = tariff.get().getAmount();
                        }
                    }
                }
            }

            // Fallback : on prend le premier acte CONSULTATION actif du catalogue.
            if (resolvedActId == null) {
                Optional<Act> fallback = actRepository.findAllByActiveTrue().stream()
                        .filter(a -> "CONSULTATION".equalsIgnoreCase(a.getType()))
                        .findFirst();
                if (fallback.isPresent()) {
                    Act a = fallback.get();
                    resolvedActId = a.getId();
                    resolvedAmount = catalogService
                            .getEffectiveTariff(a.getId(), tier, event.signedAt().toLocalDate())
                            .map(Tariff::getAmount)
                            .orElse(a.getDefaultPrice());
                }
            }

            if (resolvedActId != null && resolvedAmount != null) {
                Optional<Act> act = actRepository.findById(resolvedActId);
                InvoiceLine line = new InvoiceLine();
                line.setInvoiceId(invoice.getId());
                line.setActId(resolvedActId);
                line.setPosition(position++);
                line.setDescription(act.map(Act::getName).orElse("Consultation"));
                line.setUnitPrice(resolvedAmount);
                line.setQuantity(BigDecimal.ONE);
                line.setLineTotal(resolvedAmount);
                invoiceLineRepository.save(line);
                totalAmount = resolvedAmount;
            }

            // Step 2bis: Append prestations performed during the consultation (V016).
            // The unit_price stored on clinical_consultation_prestation is already the
            // snapshot at add-time (CONSULT_LOCKED on signed → no further mutation).
            List<ConsultationPrestation> prestationLinks =
                    consultationPrestationRepository.findByConsultationIdOrderByCreatedAtAsc(
                            event.consultationId());
            if (!prestationLinks.isEmpty()) {
                java.util.Map<UUID, Prestation> labelLookup = prestationRepository
                        .findAllById(prestationLinks.stream()
                                .map(ConsultationPrestation::getPrestationId)
                                .toList())
                        .stream()
                        .collect(java.util.stream.Collectors.toMap(Prestation::getId, p -> p));
                for (ConsultationPrestation link : prestationLinks) {
                    Prestation p = labelLookup.get(link.getPrestationId());
                    BigDecimal qty = BigDecimal.valueOf(link.getQuantity());
                    BigDecimal lineTotal = link.getUnitPrice().multiply(qty);
                    InvoiceLine line = new InvoiceLine();
                    line.setInvoiceId(invoice.getId());
                    line.setPosition(position++);
                    line.setDescription(p != null ? p.getLabel() : "Prestation");
                    line.setUnitPrice(link.getUnitPrice());
                    line.setQuantity(qty);
                    line.setLineTotal(lineTotal);
                    invoiceLineRepository.save(line);
                    totalAmount = totalAmount.add(lineTotal);
                }
            }

            // Step 3: Apply tier discount
            BigDecimal discountAmount = BigDecimal.ZERO;
            if (!"NORMAL".equals(tier)) {
                Optional<ConfigPatientTier> tierConfig = tierRepository.findByTier(tier);
                if (tierConfig.isPresent() && tierConfig.get().getDiscountPercent().compareTo(BigDecimal.ZERO) > 0) {
                    discountAmount = totalAmount
                            .multiply(tierConfig.get().getDiscountPercent())
                            .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                }
            }

            BigDecimal netAmount = totalAmount.subtract(discountAmount);
            invoice.setTotalAmount(totalAmount);
            invoice.setDiscountAmount(discountAmount);
            invoice.setNetAmount(netAmount);
            invoiceRepository.save(invoice);

            log.info("Draft invoice created for consultation {} patient {} tier {} total {}",
                    event.consultationId(), event.patientId(), tier, netAmount);

        } catch (Exception e) {
            log.error("Failed to create draft invoice for consultation {}: {}",
                    event.consultationId(), e.getMessage(), e);
        }
    }

    private UUID resolveDefaultActId(Appointment appt) {
        if (appt.getReasonId() == null) return null;
        // Use JDBC to read scheduling_appointment_reason.default_act_id
        // without importing the scheduling module's internal domain types.
        try {
            List<UUID> results = jdbc.query(
                    "SELECT default_act_id FROM scheduling_appointment_reason WHERE id = ? AND default_act_id IS NOT NULL",
                    (rs, rowNum) -> rs.getObject("default_act_id", UUID.class),
                    appt.getReasonId());
            return results.isEmpty() ? null : results.get(0);
        } catch (Exception e) {
            log.warn("Could not resolve default_act_id for reason {}: {}", appt.getReasonId(), e.getMessage());
            return null;
        }
    }

    // ── Read operations ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public Invoice getInvoice(UUID invoiceId) {
        return invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("INV_NOT_FOUND", "Facture introuvable : " + invoiceId));
    }

    @Transactional(readOnly = true)
    public Invoice getInvoiceByConsultation(UUID consultationId) {
        return invoiceRepository.findByConsultationId(consultationId)
                .orElseThrow(() -> new NotFoundException(
                        "INV_NOT_FOUND", "Aucune facture pour la consultation : " + consultationId));
    }

    @Transactional(readOnly = true)
    public List<Invoice> getInvoices(InvoiceStatus status) {
        if (status == null) {
            return invoiceRepository.findAll();
        }
        return invoiceRepository.findByStatus(status);
    }

    @Transactional(readOnly = true)
    public List<Invoice> getInvoicesForPatient(UUID patientId) {
        return invoiceRepository.findByPatientId(patientId);
    }

    @Transactional(readOnly = true)
    public List<InvoiceLine> getLinesForInvoice(UUID invoiceId) {
        return invoiceLineRepository.findByInvoiceIdOrderByPosition(invoiceId);
    }

    @Transactional(readOnly = true)
    public List<Payment> getPaymentsForInvoice(UUID invoiceId) {
        return paymentRepository.findByInvoiceIdOrderByReceivedAtDesc(invoiceId);
    }

    /**
     * Filtered + paginated invoice search with KPI aggregates over the full match.
     *
     * <p>Implementation note: we load the full filtered set in one query to compute
     * KPIs and slice in-memory for pagination. Acceptable while bounded by the export
     * cap (10 000) — beyond that we'll switch to streaming.
     */
    @Transactional(readOnly = true)
    public InvoiceSearchResponse searchInvoices(InvoiceSearchFilter filter, int page, int size) {
        var spec = InvoiceSpecifications.build(filter);
        List<Invoice> matched = new java.util.ArrayList<>(invoiceRepository.findAll(spec));
        sortIssuedDescNullsLast(matched);
        int total = matched.size();
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(200, size));
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        List<Invoice> pageItems = matched.subList(from, to);

        BigDecimal totalNet = sum(matched, Invoice::getNetAmount);
        BigDecimal totalPaid = sum(matched, Invoice::getPaidTotal);
        BigDecimal totalRemaining = totalNet.subtract(totalPaid);

        List<InvoiceListRow> rows = enrich(pageItems);
        return new InvoiceSearchResponse(rows, total, safePage, safeSize, totalNet, totalPaid, totalRemaining);
    }

    /** Loads matching invoices for export as enriched rows, capped at {@code maxRows}. */
    @Transactional(readOnly = true)
    public List<InvoiceListRow> exportInvoices(InvoiceSearchFilter filter, int maxRows) {
        var spec = InvoiceSpecifications.build(filter);
        long count = invoiceRepository.count(spec);
        if (count > maxRows) {
            throw new BusinessException(
                    "EXPORT_TOO_LARGE",
                    "Trop de résultats (" + count + "). Affinez les filtres (max " + maxRows + ").",
                    HttpStatus.UNPROCESSABLE_ENTITY.value());
        }
        List<Invoice> matched = new java.util.ArrayList<>(invoiceRepository.findAll(spec));
        sortIssuedDescNullsLast(matched);
        return enrich(matched);
    }

    /**
     * Sort invoices by issued_at DESC NULLS LAST, then created_at DESC. Done in-memory
     * to dodge Hibernate's inconsistent NULLS LAST translation on PostgreSQL DESC.
     */
    private static void sortIssuedDescNullsLast(List<Invoice> invoices) {
        invoices.sort(Comparator
                .comparing(Invoice::getIssuedAt,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(Invoice::getCreatedAt, Comparator.reverseOrder()));
    }

    private List<InvoiceListRow> enrich(List<Invoice> invoices) {
        if (invoices.isEmpty()) return List.of();

        // Batch-load patients
        Set<UUID> patientIds = new java.util.HashSet<>();
        Set<UUID> insuranceIds = new java.util.HashSet<>();
        Set<UUID> invoiceIds = new java.util.HashSet<>();
        for (Invoice inv : invoices) {
            patientIds.add(inv.getPatientId());
            invoiceIds.add(inv.getId());
            if (inv.getMutuelleInsuranceId() != null) insuranceIds.add(inv.getMutuelleInsuranceId());
        }
        Map<UUID, Patient> patientMap = new HashMap<>();
        for (Patient p : patientRepository.findAllById(patientIds)) patientMap.put(p.getId(), p);

        Map<UUID, String> insuranceNames = new HashMap<>();
        if (!insuranceIds.isEmpty()) {
            jdbc.query(
                    "SELECT id, name FROM catalog_insurance WHERE id = ANY (?)",
                    ps -> ps.setArray(1, ps.getConnection().createArrayOf(
                            "uuid", insuranceIds.toArray())),
                    (rs, i) -> {
                        insuranceNames.put((UUID) rs.getObject("id"), rs.getString("name"));
                        return null;
                    });
        }

        // Batch-load payments per invoice
        List<Payment> allPayments = paymentRepository.findByInvoiceIdIn(invoiceIds);
        Map<UUID, List<Payment>> paymentsByInvoice = new HashMap<>();
        for (Payment p : allPayments) {
            paymentsByInvoice.computeIfAbsent(p.getInvoiceId(), k -> new java.util.ArrayList<>()).add(p);
        }

        return invoices.stream().map(inv -> {
            Patient pat = patientMap.get(inv.getPatientId());
            String fullName = pat == null
                    ? ""
                    : (safe(pat.getLastName()) + " " + safe(pat.getFirstName())).trim();
            String phone = pat == null ? null : pat.getPhone();
            String mutuelle = inv.getMutuelleInsuranceId() == null
                    ? null
                    : insuranceNames.get(inv.getMutuelleInsuranceId());

            List<Payment> ps = paymentsByInvoice.getOrDefault(inv.getId(), List.of());
            Set<PaymentMode> modes = ps.isEmpty()
                    ? EnumSet.noneOf(PaymentMode.class)
                    : ps.stream()
                            .map(Payment::getMode)
                            .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
            OffsetDateTime lastPaymentAt = ps.stream()
                    .map(Payment::getReceivedAt)
                    .max(Comparator.naturalOrder())
                    .orElse(null);

            return new InvoiceListRow(
                    inv.getId(),
                    inv.getNumber(),
                    inv.getStatus(),
                    inv.getPatientId(),
                    fullName,
                    phone,
                    mutuelle,
                    inv.getTotalAmount(),
                    inv.getDiscountAmount(),
                    inv.getNetAmount(),
                    inv.getPaidTotal(),
                    modes,
                    inv.getIssuedAt(),
                    lastPaymentAt,
                    inv.getCreatedAt());
        }).toList();
    }

    private static String safe(String s) { return s == null ? "" : s; }

    private static BigDecimal sum(List<Invoice> invoices, java.util.function.Function<Invoice, BigDecimal> f) {
        BigDecimal acc = BigDecimal.ZERO;
        for (Invoice inv : invoices) {
            BigDecimal v = f.apply(inv);
            if (v != null) acc = acc.add(v);
        }
        return acc;
    }

    // ── Write operations ──────────────────────────────────────────────────────

    @Transactional
    public Invoice updateInvoice(UUID invoiceId, InvoiceUpdateRequest req, UUID actorId) {
        Invoice invoice = loadDraftOrThrow(invoiceId);

        if (req.lines() != null) {
            invoiceLineRepository.deleteByInvoiceId(invoiceId);
            BigDecimal total = BigDecimal.ZERO;
            int pos = 0;
            for (InvoiceLineRequest lr : req.lines()) {
                InvoiceLine line = new InvoiceLine();
                line.setInvoiceId(invoiceId);
                line.setPosition(pos++);
                line.setActId(lr.actId());
                line.setDescription(lr.description());
                line.setUnitPrice(lr.unitPrice());
                BigDecimal qty = lr.quantity() != null ? lr.quantity() : BigDecimal.ONE;
                line.setQuantity(qty);
                line.setLineTotal(lr.unitPrice().multiply(qty));
                invoiceLineRepository.save(line);
                total = total.add(line.getLineTotal());
            }
            invoice.setTotalAmount(total);
        }

        if (req.discountAmount() != null) {
            invoice.setDiscountAmount(req.discountAmount());
        }

        invoice.setNetAmount(invoice.getTotalAmount().subtract(invoice.getDiscountAmount()));
        return invoice;
    }

    @Transactional
    public Invoice adjustTotal(UUID consultationId, AdjustTotalRequest req, UUID doctorId) {
        Invoice invoice = invoiceRepository.findByConsultationId(consultationId)
                .orElseThrow(() -> new NotFoundException(
                        "INV_NOT_FOUND", "Aucune facture pour la consultation : " + consultationId));
        if (invoice.getStatus() != InvoiceStatus.BROUILLON) {
            throw new BusinessException(
                    "INV_NOT_DRAFT",
                    "Seule une facture en brouillon peut être ajustée.",
                    HttpStatus.CONFLICT.value());
        }
        invoice.setDiscountAmount(req.discountAmount());
        invoice.setNetAmount(invoice.getTotalAmount().subtract(req.discountAmount()));
        invoice.setAdjustedBy(doctorId);
        invoice.setAdjustedAt(OffsetDateTime.now());
        return invoice;
    }

    @Transactional
    public IssueInvoiceResponse issueInvoice(UUID invoiceId, UUID actorId) {
        Invoice invoice = loadDraftOrThrow(invoiceId);

        // Assign sequential number via SELECT FOR UPDATE
        String number = sequenceRepository.nextInvoiceNumber();
        invoice.setNumber(number);
        invoice.setStatus(InvoiceStatus.EMISE);
        invoice.setIssuedAt(OffsetDateTime.now());
        invoice.setIssuedBy(actorId);
        invoiceRepository.save(invoice);

        return new IssueInvoiceResponse(
                invoice.getId(),
                number,
                invoice.getNetAmount(),
                invoice.getIssuedAt(),
                "/api/invoices/" + invoiceId + "/pdf"
        );
    }

    @Transactional
    public PaymentResponse recordPayment(UUID invoiceId, RecordPaymentRequest req, UUID actorId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("INV_NOT_FOUND", "Facture introuvable : " + invoiceId));

        if (invoice.getStatus() == InvoiceStatus.BROUILLON
                || invoice.getStatus() == InvoiceStatus.ANNULEE) {
            throw new BusinessException(
                    "INV_INVALID_STATUS",
                    "Un paiement ne peut être enregistré que sur une facture émise.",
                    HttpStatus.CONFLICT.value());
        }

        Payment payment = new Payment();
        payment.setInvoiceId(invoiceId);
        payment.setMode(req.mode());
        payment.setAmount(req.amount());
        payment.setReceivedBy(actorId);
        payment.setReference(req.reference());
        if (req.paidAt() != null) payment.setReceivedAt(req.paidAt());
        paymentRepository.save(payment);

        // Recalculate paid total and update status
        List<Payment> allPayments = paymentRepository.findByInvoiceIdOrderByReceivedAtDesc(invoiceId);
        BigDecimal paidTotal = allPayments.stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        invoice.setPaidTotal(paidTotal);

        if (paidTotal.compareTo(invoice.getNetAmount()) >= 0) {
            invoice.setStatus(InvoiceStatus.PAYEE_TOTALE);
        } else {
            invoice.setStatus(InvoiceStatus.PAYEE_PARTIELLE);
        }

        return new PaymentResponse(
                payment.getId(),
                payment.getAmount(),
                payment.getMode(),
                payment.getReference(),
                payment.getReceivedAt()
        );
    }

    @Transactional
    public CreditNoteResponse issueCreditNote(UUID invoiceId, ma.careplus.billing.infrastructure.web.dto.CreditNoteRequest req, UUID actorId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("INV_NOT_FOUND", "Facture introuvable : " + invoiceId));

        if (invoice.getStatus() != InvoiceStatus.EMISE
                && invoice.getStatus() != InvoiceStatus.PAYEE_PARTIELLE
                && invoice.getStatus() != InvoiceStatus.PAYEE_TOTALE) {
            throw new BusinessException(
                    "INV_INVALID_STATUS",
                    "Un avoir ne peut être émis que sur une facture émise ou partiellement/totalement payée.",
                    HttpStatus.CONFLICT.value());
        }

        // Create credit note with sequential number (A prefix)
        String creditNoteNumber = sequenceRepository.nextCreditNoteNumber();
        CreditNote creditNote = new CreditNote();
        creditNote.setNumber(creditNoteNumber);
        creditNote.setOriginalInvoiceId(invoiceId);
        creditNote.setAmount(invoice.getNetAmount().negate());
        creditNote.setReason(req.reason());
        creditNote.setIssuedBy(actorId);
        creditNote.setIssuedAt(OffsetDateTime.now());
        creditNoteRepository.save(creditNote);

        // Mark original invoice as cancelled
        invoice.setStatus(InvoiceStatus.ANNULEE);
        invoice.setCancelledAt(OffsetDateTime.now());
        invoice.setCreditNoteId(creditNote.getId());

        return new CreditNoteResponse(
                creditNote.getId(),
                invoiceId,
                creditNote.getAmount(),
                creditNote.getReason(),
                creditNote.getIssuedAt()
        );
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private Invoice loadDraftOrThrow(UUID invoiceId) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new NotFoundException("INV_NOT_FOUND", "Facture introuvable : " + invoiceId));
        if (invoice.getStatus() != InvoiceStatus.BROUILLON) {
            throw new BusinessException(
                    "INV_NOT_DRAFT",
                    "Cette opération ne peut être effectuée que sur une facture en brouillon. Statut actuel : "
                            + invoice.getStatus(),
                    HttpStatus.CONFLICT.value());
        }
        return invoice;
    }
}
