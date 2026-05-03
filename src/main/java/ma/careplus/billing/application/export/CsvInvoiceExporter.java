package ma.careplus.billing.application.export;

import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;
import ma.careplus.billing.infrastructure.web.dto.InvoiceListRow;

/**
 * CSV exporter for invoice rows.
 *
 * <p>Encoding UTF-8 with BOM (so Excel-Windows reads accents correctly), separator {@code ;}
 * (FR/MA locale where comma is the decimal separator), dates {@code JJ/MM/AAAA}, decimals
 * with comma. Quoting only when a cell contains {@code ;} {@code "} or newline.
 */
public class CsvInvoiceExporter implements InvoiceExporter {

    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");
    private static final String SEP = ";";
    private static final char[] BOM = new char[]{'﻿'};

    @Override
    public String contentType() {
        return "text/csv; charset=utf-8";
    }

    @Override
    public String fileExtension() {
        return ".csv";
    }

    @Override
    public void write(List<InvoiceListRow> rows, OutputStream out) throws IOException {
        Writer w = new OutputStreamWriter(out, StandardCharsets.UTF_8);
        w.write(BOM); // UTF-8 BOM for Excel-Windows
        // Header
        w.write(String.join(SEP, InvoiceExportColumns.HEADERS));
        w.write("\r\n");
        // Rows
        for (InvoiceListRow r : rows) {
            w.write(toLine(r));
            w.write("\r\n");
        }
        w.flush();
    }

    private String toLine(InvoiceListRow r) {
        BigDecimal remaining = nz(r.netAmount()).subtract(nz(r.paidAmount()));
        String modes = r.paymentModes().stream().map(Enum::name).collect(Collectors.joining(", "));
        return String.join(SEP,
                quote(nullSafe(r.number())),
                quote(formatDate(r.issuedAt())),
                quote(InvoiceExportColumns.STATUS_LABEL.getOrDefault(r.status(), r.status().name())),
                quote(nullSafe(r.patientFullName())),
                quote(nullSafe(r.patientPhone())),
                quote(nullSafe(r.mutuelleName())),
                formatAmount(r.totalAmount()),
                formatAmount(r.discountAmount()),
                formatAmount(r.netAmount()),
                formatAmount(r.paidAmount()),
                formatAmount(remaining),
                quote(modes),
                quote(formatDate(r.lastPaymentAt())),
                quote(formatDate(r.createdAt())));
    }

    private static String formatAmount(BigDecimal v) {
        if (v == null) return "";
        return v.setScale(2, RoundingMode.HALF_UP).toPlainString().replace('.', ',');
    }

    private static String formatDate(OffsetDateTime t) {
        if (t == null) return "";
        return t.atZoneSameInstant(CASA).toLocalDate().format(InvoiceExportColumns.DATE_FR);
    }

    private static String nullSafe(String s) { return s == null ? "" : s; }
    private static BigDecimal nz(BigDecimal b) { return b == null ? BigDecimal.ZERO : b; }

    private static String quote(String value) {
        if (value == null || value.isEmpty()) return "";
        boolean mustQuote = value.indexOf(';') >= 0
                || value.indexOf('"') >= 0
                || value.indexOf('\n') >= 0
                || value.indexOf('\r') >= 0;
        if (!mustQuote) return value;
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}
