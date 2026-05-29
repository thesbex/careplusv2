package ma.careplus.hospitalization.infrastructure.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Détail d'un séjour : identité + statut + historique d'affectations (ADT) +
 * aperçu de la facturation (lignes hébergement nuits × prix de journée + prestations).
 */
public record StayDetailView(
        UUID id,
        UUID patientId,
        String patientFirstName,
        String patientLastName,
        String status,
        String admissionReason,
        UUID attendingPractitionerId,
        Instant admittedAt,
        Instant dischargedAt,
        String dischargeType,
        String dischargeSummary,
        UUID invoiceId,
        List<AssignmentView> assignments,
        List<ChargeLine> chargePreview,
        BigDecimal chargeTotal,
        List<PrestationLine> prestations,
        BigDecimal prestationsTotal,
        /** Factures de consultation (acte + radio/labo internes) faites pendant le séjour,
         *  encore en brouillon — seront englobées dans la facture de séjour à la sortie. */
        List<PendingConsultationInvoice> pendingConsultationInvoices) {

    /** Une affectation de lit dans l'historique ADT. */
    public record AssignmentView(
            UUID id,
            UUID bedId,
            String bedLabel,
            String wardLabel,
            BigDecimal dailyRate,
            Instant fromAt,
            Instant toAt,
            int nights) {}

    /** Une ligne d'aperçu de facturation (hébergement par classe de chambre). */
    public record ChargeLine(
            String description,
            BigDecimal unitPrice,
            int quantity,
            BigDecimal lineTotal) {}

    /** Une prestation de séjour (acte supplémentaire en sus du prix de journée). */
    public record PrestationLine(
            UUID id,
            UUID actId,
            String label,
            BigDecimal unitPrice,
            BigDecimal quantity,
            BigDecimal lineTotal) {}

    /** Une facture de consultation en attente d'absorption dans la facture de séjour. */
    public record PendingConsultationInvoice(
            UUID invoiceId,
            String number,
            BigDecimal netAmount,
            Instant consultDate) {}
}
