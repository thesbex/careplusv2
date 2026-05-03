package ma.careplus.billing.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Invoice aggregate root. Maps billing_invoice (V001 + V005 additions).
 * No soft delete — billing records are legally immutable.
 * Sequential number assigned at issue time via SELECT FOR UPDATE on billing_invoice_sequence.
 */
@Entity
@Table(name = "billing_invoice")
public class Invoice {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    /** YYYY-NNNNNN format. NULL while status=BROUILLON. */
    @Column(name = "number", length = 16, unique = true)
    private String number;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "consultation_id")
    private UUID consultationId;

    @Column(name = "appointment_id")
    private UUID appointmentId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private InvoiceStatus status = InvoiceStatus.BROUILLON;

    /** Sum of all line totals before discount. Maps to V001 'total' column. */
    @Column(name = "total", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount = BigDecimal.ZERO;

    /** Médecin-applied discount. Added in V005. */
    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;

    /** totalAmount - discountAmount. Added in V005. */
    @Column(name = "net_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal netAmount = BigDecimal.ZERO;

    /** Total payments received. Maps to V001 'paid_total'. */
    @Column(name = "paid_total", nullable = false, precision = 10, scale = 2)
    private BigDecimal paidTotal = BigDecimal.ZERO;

    /** Copy of patient mutuelle at invoice creation time. Added in V005. */
    @Column(name = "mutuelle_insurance_id")
    private UUID mutuelleInsuranceId;

    /** Copy of patient mutuelle policy number at invoice creation. Added in V005. */
    @Column(name = "mutuelle_policy_number", length = 100)
    private String mutuellePoliceNumber;

    /** User who applied the discount (MEDECIN). Added in V005. */
    @Column(name = "adjusted_by")
    private UUID adjustedBy;

    @Column(name = "adjusted_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime adjustedAt;

    @Column(name = "issued_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime issuedAt;

    @Column(name = "issued_by")
    private UUID issuedBy;

    @Column(name = "cancelled_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime cancelledAt;

    /** FK to billing_credit_note when this invoice was cancelled via credit note. */
    @Column(name = "credit_note_id")
    private UUID creditNoteId;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        OffsetDateTime now = OffsetDateTime.now();
        if (createdAt == null) createdAt = now;
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public String getNumber() { return number; }
    public void setNumber(String number) { this.number = number; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public UUID getConsultationId() { return consultationId; }
    public void setConsultationId(UUID consultationId) { this.consultationId = consultationId; }
    public UUID getAppointmentId() { return appointmentId; }
    public void setAppointmentId(UUID appointmentId) { this.appointmentId = appointmentId; }
    public InvoiceStatus getStatus() { return status; }
    public void setStatus(InvoiceStatus status) { this.status = status; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public BigDecimal getNetAmount() { return netAmount; }
    public void setNetAmount(BigDecimal netAmount) { this.netAmount = netAmount; }
    public BigDecimal getPaidTotal() { return paidTotal; }
    public void setPaidTotal(BigDecimal paidTotal) { this.paidTotal = paidTotal; }
    public UUID getMutuelleInsuranceId() { return mutuelleInsuranceId; }
    public void setMutuelleInsuranceId(UUID mutuelleInsuranceId) { this.mutuelleInsuranceId = mutuelleInsuranceId; }
    public String getMutuellePoliceNumber() { return mutuellePoliceNumber; }
    public void setMutuellePoliceNumber(String mutuellePoliceNumber) { this.mutuellePoliceNumber = mutuellePoliceNumber; }
    public UUID getAdjustedBy() { return adjustedBy; }
    public void setAdjustedBy(UUID adjustedBy) { this.adjustedBy = adjustedBy; }
    public OffsetDateTime getAdjustedAt() { return adjustedAt; }
    public void setAdjustedAt(OffsetDateTime adjustedAt) { this.adjustedAt = adjustedAt; }
    public OffsetDateTime getIssuedAt() { return issuedAt; }
    public void setIssuedAt(OffsetDateTime issuedAt) { this.issuedAt = issuedAt; }
    public UUID getIssuedBy() { return issuedBy; }
    public void setIssuedBy(UUID issuedBy) { this.issuedBy = issuedBy; }
    public OffsetDateTime getCancelledAt() { return cancelledAt; }
    public void setCancelledAt(OffsetDateTime cancelledAt) { this.cancelledAt = cancelledAt; }
    public UUID getCreditNoteId() { return creditNoteId; }
    public void setCreditNoteId(UUID creditNoteId) { this.creditNoteId = creditNoteId; }
    public long getVersion() { return version; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }
    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
