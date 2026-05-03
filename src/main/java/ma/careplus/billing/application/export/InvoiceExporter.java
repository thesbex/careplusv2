package ma.careplus.billing.application.export;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;
import ma.careplus.billing.infrastructure.web.dto.InvoiceListRow;

/** Strategy for serializing a list of {@link InvoiceListRow} to a binary stream. */
public interface InvoiceExporter {

    /** MIME type for the {@code Content-Type} header. */
    String contentType();

    /** Filename suffix (with leading dot), e.g. {@code .csv} / {@code .xlsx}. */
    String fileExtension();

    /** Writes rows to {@code out}. The caller closes the stream. */
    void write(List<InvoiceListRow> rows, OutputStream out) throws IOException;
}
