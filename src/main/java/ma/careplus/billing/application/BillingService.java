package ma.careplus.billing.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
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
import ma.careplus.billing.infrastructure.web.dto.AdjustTotalRequest;
import ma.careplus.billing.infrastructure.web.dto.CreditNoteResponse;
import ma.careplus.billing.infrastructure.web.dto.InvoiceLineRequest;
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

            // Step 2: Resolve lines from appointment reason's default act
            BigDecimal totalAmount = BigDecimal.ZERO;
            if (event.appointmentId() != null) {
                Optional<Appointment> apptOpt = appointmentRepository.findById(event.appointmentId());
                if (apptOpt.isPresent()) {
                    UUID defaultActId = resolveDefaultActId(apptOpt.get());
                    if (defaultActId != null) {
                        Optional<Tariff> tariff = catalogService.getEffectiveTariff(
                                defaultActId, tier, event.signedAt().toLocalDate());
                        if (tariff.isPresent()) {
                            BigDecimal amount = tariff.get().getAmount();
                            Optional<Act> act = actRepository.findById(defaultActId);
                            InvoiceLine line = new InvoiceLine();
                            line.setInvoiceId(invoice.getId());
                            line.setActId(defaultActId);
                            line.setDescription(act.map(Act::getName).orElse("Consultation"));
                            line.setUnitPrice(amount);
                            line.setQuantity(BigDecimal.ONE);
                            line.setLineTotal(amount);
                            invoiceLineRepository.save(line);
                            totalAmount = amount;
                        }
                    }
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
