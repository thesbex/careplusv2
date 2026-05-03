package ma.careplus.billing.application.export;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import ma.careplus.billing.domain.InvoiceStatus;

/** Shared header labels and value formatting helpers for CSV + xlsx exporters. */
public final class InvoiceExportColumns {

    public static final List<String> HEADERS = List.of(
            "Numéro",
            "Date émission",
            "Statut",
            "Patient",
            "Téléphone",
            "Mutuelle",
            "Total brut (MAD)",
            "Remise (MAD)",
            "Net (MAD)",
            "Encaissé (MAD)",
            "Reste (MAD)",
            "Modes de paiement",
            "Date dernier encaissement",
            "Date création");

    public static final DateTimeFormatter DATE_FR = DateTimeFormatter.ofPattern("dd/MM/yyyy", Locale.FRENCH);

    public static final Map<InvoiceStatus, String> STATUS_LABEL = Map.of(
            InvoiceStatus.BROUILLON, "Brouillon",
            InvoiceStatus.EMISE, "Émise",
            InvoiceStatus.PAYEE_PARTIELLE, "Partielle",
            InvoiceStatus.PAYEE_TOTALE, "Payée",
            InvoiceStatus.ANNULEE, "Annulée");

    private InvoiceExportColumns() {}
}
