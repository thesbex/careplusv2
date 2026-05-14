package ma.careplus.configuration.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Read-only directory of the document templates seeded in V001/V002.
 *
 * <p>Used by the onboarding wizard's "Documents" step to confirm to the admin
 * which document types are pre-configured for their cabinet (ordonnance,
 * certificat, etc.) without exposing the full HTML payload — the body of the
 * template is admin-settings territory (Paramétrage → Documents) and not
 * fetched here for size reasons.
 */
@RestController
@Tag(name = "settings", description = "Document templates (read-only inventory)")
public class DocumentTemplateController {

    private final JdbcTemplate jdbc;

    public DocumentTemplateController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** One template row, metadata only (no html_template body). */
    public record DocumentTemplateView(
            UUID id,
            String type,
            String pageFormat,
            int templateBytes,
            OffsetDateTime updatedAt
    ) {}

    @GetMapping("/api/settings/document-templates")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(summary = "Lister les modèles de documents configurés (métadonnées)")
    public List<DocumentTemplateView> list() {
        return jdbc.query(
                "SELECT id, type, page_format, "
                        + "COALESCE(octet_length(html_template), 0) AS sz, "
                        + "updated_at "
                        + "FROM configuration_document_template "
                        + "ORDER BY type",
                (rs, i) -> new DocumentTemplateView(
                        (UUID) rs.getObject("id"),
                        rs.getString("type"),
                        rs.getString("page_format"),
                        rs.getInt("sz"),
                        rs.getObject("updated_at", OffsetDateTime.class)));
    }
}
