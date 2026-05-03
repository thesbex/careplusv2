package ma.careplus.billing.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.billing.application.BillingService;
import ma.careplus.billing.application.InvoiceSearchFilter;
import ma.careplus.billing.application.export.CsvInvoiceExporter;
import ma.careplus.billing.application.export.InvoiceExporter;
import ma.careplus.billing.application.export.XlsxInvoiceExporter;
import ma.careplus.billing.domain.Invoice;
import ma.careplus.billing.domain.InvoiceLine;
import ma.careplus.billing.domain.InvoiceStatus;
import ma.careplus.billing.domain.Payment;
import ma.careplus.billing.domain.PaymentMode;
import ma.careplus.billing.infrastructure.web.dto.AdjustTotalRequest;
import ma.careplus.billing.infrastructure.web.dto.CreditNoteRequest;
import ma.careplus.billing.infrastructure.web.dto.CreditNoteResponse;
import ma.careplus.billing.infrastructure.web.dto.InvoiceListRow;
import ma.careplus.billing.infrastructure.web.dto.InvoiceLineResponse;
import ma.careplus.billing.infrastructure.web.dto.InvoiceResponse;
import ma.careplus.billing.infrastructure.web.dto.InvoiceSearchResponse;
import ma.careplus.billing.infrastructure.web.dto.InvoiceUpdateRequest;
import ma.careplus.billing.infrastructure.web.dto.IssueInvoiceResponse;
import ma.careplus.billing.infrastructure.web.dto.PaymentResponse;
import ma.careplus.billing.infrastructure.web.dto.RecordPaymentRequest;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Billing REST endpoints.
 * All endpoints require at minimum SECRETAIRE role.
 * Adjust-total is MEDECIN only (MEDECIN adjusts discount before signing).
 */
@RestController
@Tag(name = "billing", description = "Facturation — invoices, payments, credit notes")
public class BillingController {

    private final BillingService billingService;

    public BillingController(BillingService billingService) {
        this.billingService = billingService;
    }

    // ── Invoice list + detail ─────────────────────────────────────────────────

    @GetMapping("/api/invoices")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<InvoiceResponse>> listInvoices(
            @RequestParam(required = false) InvoiceStatus status,
            @RequestParam(required = false) UUID patientId,
            Authentication auth) {
        List<Invoice> invoices = patientId != null
                ? billingService.getInvoicesForPatient(patientId)
                : billingService.getInvoices(status);
        return ResponseEntity.ok(invoices.stream().map(this::toResponse).toList());
    }

    /** Hard cap for /export. Beyond this, the endpoint returns 422 EXPORT_TOO_LARGE. */
    private static final int EXPORT_MAX_ROWS = 10_000;

    /**
     * Filtered + paginated invoice search with KPI aggregates.
     * Supports filters: dateField (ISSUED|PAID) + from/to, status[], paymentMode[],
     * patientId, amountMin/Max. All filters AND-combined.
     */
    @GetMapping("/api/invoices/search")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<InvoiceSearchResponse> searchInvoices(
            @RequestParam(required = false, defaultValue = "ISSUED") InvoiceSearchFilter.DateField dateField,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<InvoiceStatus> status,
            @RequestParam(required = false) List<PaymentMode> paymentMode,
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) BigDecimal amountMin,
            @RequestParam(required = false) BigDecimal amountMax,
            @RequestParam(required = false, defaultValue = "0") int page,
            @RequestParam(required = false, defaultValue = "50") int size) {
        InvoiceSearchFilter filter = new InvoiceSearchFilter(
                dateField, from, to,
                status == null ? List.of() : status,
                paymentMode == null ? List.of() : paymentMode,
                patientId, amountMin, amountMax);
        return ResponseEntity.ok(billingService.searchInvoices(filter, page, size));
    }

    /**
     * Streams a CSV or xlsx export of the same filter set as {@code /search}.
     * Capped at {@value #EXPORT_MAX_ROWS} rows — beyond, returns 422 EXPORT_TOO_LARGE.
     * RBAC: MEDECIN + ADMIN only (SECRETAIRE / ASSISTANT can browse on screen but not extract).
     */
    @GetMapping("/api/invoices/export")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<byte[]> exportInvoices(
            @RequestParam(required = false, defaultValue = "ISSUED") InvoiceSearchFilter.DateField dateField,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) List<InvoiceStatus> status,
            @RequestParam(required = false) List<PaymentMode> paymentMode,
            @RequestParam(required = false) UUID patientId,
            @RequestParam(required = false) BigDecimal amountMin,
            @RequestParam(required = false) BigDecimal amountMax,
            @RequestParam(required = false, defaultValue = "csv") String format) throws IOException {
        InvoiceSearchFilter filter = new InvoiceSearchFilter(
                dateField, from, to,
                status == null ? List.of() : status,
                paymentMode == null ? List.of() : paymentMode,
                patientId, amountMin, amountMax);
        List<InvoiceListRow> rows = billingService.exportInvoices(filter, EXPORT_MAX_ROWS);

        InvoiceExporter exporter = "xlsx".equalsIgnoreCase(format)
                ? new XlsxInvoiceExporter()
                : new CsvInvoiceExporter();
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        exporter.write(rows, buf);

        String fromPart = from != null ? from.toString() : "all";
        String toPart = to != null ? to.toString() : "all";
        String filename = "factures_" + fromPart + "_" + toPart + exporter.fileExtension();

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(exporter.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(buf.toByteArray());
    }

    @GetMapping("/api/invoices/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<InvoiceResponse> getInvoice(@PathVariable UUID id, Authentication auth) {
        return ResponseEntity.ok(toResponse(billingService.getInvoice(id)));
    }

    @GetMapping("/api/consultations/{consultationId}/invoice")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<InvoiceResponse> getInvoiceByConsultation(
            @PathVariable UUID consultationId, Authentication auth) {
        return ResponseEntity.ok(toResponse(billingService.getInvoiceByConsultation(consultationId)));
    }

    // ── Edit draft ────────────────────────────────────────────────────────────

    @PutMapping("/api/invoices/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<InvoiceResponse> updateInvoice(
            @PathVariable UUID id,
            @Valid @RequestBody InvoiceUpdateRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(toResponse(billingService.updateInvoice(id, req, actorId)));
    }

    @PutMapping("/api/consultations/{consultationId}/invoice-total")
    @PreAuthorize("hasRole('MEDECIN')")
    public ResponseEntity<InvoiceResponse> adjustTotal(
            @PathVariable UUID consultationId,
            @Valid @RequestBody AdjustTotalRequest req,
            Authentication auth) {
        UUID doctorId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(toResponse(billingService.adjustTotal(consultationId, req, doctorId)));
    }

    // ── Issue ─────────────────────────────────────────────────────────────────

    @PostMapping("/api/invoices/{id}/issue")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<IssueInvoiceResponse> issueInvoice(
            @PathVariable UUID id, Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(billingService.issueInvoice(id, actorId));
    }

    // ── Payments ──────────────────────────────────────────────────────────────

    @PostMapping("/api/invoices/{id}/payments")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<PaymentResponse> recordPayment(
            @PathVariable UUID id,
            @Valid @RequestBody RecordPaymentRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(billingService.recordPayment(id, req, actorId));
    }

    // ── Credit note ───────────────────────────────────────────────────────────

    @PostMapping("/api/invoices/{id}/credit-note")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<CreditNoteResponse> issueCreditNote(
            @PathVariable UUID id,
            @Valid @RequestBody CreditNoteRequest req,
            Authentication auth) {
        UUID actorId = UUID.fromString(auth.getName());
        return ResponseEntity.ok(billingService.issueCreditNote(id, req, actorId));
    }

    // ── DTO conversion ────────────────────────────────────────────────────────

    private InvoiceResponse toResponse(Invoice invoice) {
        List<InvoiceLine> lines = billingService.getLinesForInvoice(invoice.getId());
        List<Payment> payments = billingService.getPaymentsForInvoice(invoice.getId());

        List<InvoiceLineResponse> lineResponses = lines.stream()
                .map(l -> new InvoiceLineResponse(
                        l.getId(),
                        l.getDescription(),
                        l.getQuantity(),
                        l.getUnitPrice(),
                        l.getLineTotal()))
                .toList();

        List<PaymentResponse> paymentResponses = payments.stream()
                .map(p -> new PaymentResponse(
                        p.getId(),
                        p.getAmount(),
                        p.getMode(),
                        p.getReference(),
                        p.getReceivedAt()))
                .toList();

        return new InvoiceResponse(
                invoice.getId(),
                invoice.getPatientId(),
                invoice.getConsultationId(),
                invoice.getStatus(),
                invoice.getNumber(),
                invoice.getTotalAmount(),
                invoice.getDiscountAmount(),
                invoice.getNetAmount(),
                lineResponses,
                paymentResponses,
                null, // mutuelleInsuranceName — lookup post-MVP
                invoice.getIssuedAt(),
                invoice.getCreatedAt()
        );
    }
}
