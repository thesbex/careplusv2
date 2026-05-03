package ma.careplus.billing.application.export;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Collectors;
import ma.careplus.billing.infrastructure.web.dto.InvoiceListRow;
import org.dhatim.fastexcel.Workbook;
import org.dhatim.fastexcel.Worksheet;

/**
 * xlsx exporter using {@code fastexcel} (~200 Ko, vs Apache POI 15 Mo).
 *
 * <p>One sheet "Factures". Headers in bold + grey background, freeze pane on row 1.
 * Amounts as Number with format {@code #,##0.00 "MAD"}, dates as Date {@code dd/mm/yyyy}.
 * SUM footer for the 3 monetary KPI columns.
 */
public class XlsxInvoiceExporter implements InvoiceExporter {

    private static final ZoneId CASA = ZoneId.of("Africa/Casablanca");
    private static final String AMOUNT_FORMAT = "#,##0.00 \"MAD\"";
    private static final String DATE_FORMAT = "dd/mm/yyyy";

    @Override
    public String contentType() {
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    }

    @Override
    public String fileExtension() {
        return ".xlsx";
    }

    @Override
    public void write(List<InvoiceListRow> rows, OutputStream out) throws IOException {
        try (Workbook wb = new Workbook(out, "careplus", "1.0")) {
            Worksheet ws = wb.newWorksheet("Factures");

            // Header
            for (int c = 0; c < InvoiceExportColumns.HEADERS.size(); c++) {
                ws.value(0, c, InvoiceExportColumns.HEADERS.get(c));
            }
            ws.range(0, 0, 0, InvoiceExportColumns.HEADERS.size() - 1)
                    .style().bold().fillColor("E8E8E8").set();
            ws.freezePane(0, 1);

            int row = 1;
            for (InvoiceListRow r : rows) {
                BigDecimal remaining = nz(r.netAmount()).subtract(nz(r.paidAmount()));
                String modes = r.paymentModes().stream()
                        .map(Enum::name).collect(Collectors.joining(", "));

                ws.value(row, 0, r.number());
                writeDate(ws, row, 1, r.issuedAt());
                ws.value(row, 2, InvoiceExportColumns.STATUS_LABEL.getOrDefault(
                        r.status(), r.status().name()));
                ws.value(row, 3, r.patientFullName());
                ws.value(row, 4, r.patientPhone());
                ws.value(row, 5, r.mutuelleName());
                writeAmount(ws, row, 6, r.totalAmount());
                writeAmount(ws, row, 7, r.discountAmount());
                writeAmount(ws, row, 8, r.netAmount());
                writeAmount(ws, row, 9, r.paidAmount());
                writeAmount(ws, row, 10, remaining);
                ws.value(row, 11, modes);
                writeDate(ws, row, 12, r.lastPaymentAt());
                writeDate(ws, row, 13, r.createdAt());
                row++;
            }

            // SUM footer for net / paid / remaining (cols 8, 9, 10)
            if (!rows.isEmpty()) {
                int sumRow = row;
                ws.value(sumRow, 0, "TOTAUX");
                for (int col : new int[]{8, 9, 10}) {
                    ws.formula(sumRow, col,
                            "SUM(" + colLetter(col) + "2:" + colLetter(col) + (sumRow) + ")");
                    ws.style(sumRow, col).format(AMOUNT_FORMAT).bold().set();
                }
                ws.style(sumRow, 0).bold().set();
            }

            // Column widths (approximate auto-fit)
            int[] widths = {14, 13, 11, 28, 14, 22, 16, 14, 14, 16, 14, 26, 22, 13};
            for (int c = 0; c < widths.length; c++) ws.width(c, widths[c]);

            ws.finish();
        }
    }

    private static void writeAmount(Worksheet ws, int row, int col, BigDecimal v) {
        if (v == null) return;
        BigDecimal scaled = v.setScale(2, RoundingMode.HALF_UP);
        ws.value(row, col, scaled);
        ws.style(row, col).format(AMOUNT_FORMAT).set();
    }

    private static void writeDate(Worksheet ws, int row, int col, OffsetDateTime t) {
        if (t == null) return;
        LocalDate d = t.atZoneSameInstant(CASA).toLocalDate();
        ws.value(row, col, d);
        ws.style(row, col).format(DATE_FORMAT).set();
    }

    private static BigDecimal nz(BigDecimal b) { return b == null ? BigDecimal.ZERO : b; }

    /** Excel column letters (0-indexed). 0→A, 25→Z, 26→AA. */
    private static String colLetter(int col) {
        StringBuilder sb = new StringBuilder();
        int n = col;
        while (n >= 0) {
            sb.insert(0, (char) ('A' + n % 26));
            n = n / 26 - 1;
        }
        return sb.toString();
    }
}
