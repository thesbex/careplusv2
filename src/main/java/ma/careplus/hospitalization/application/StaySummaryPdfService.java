package ma.careplus.hospitalization.application;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.hospitalization.infrastructure.web.dto.StayDetailView;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.shared.pdf.LogoWatermarkRenderer;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/** Génère le PDF du compte-rendu d'hospitalisation (Thymeleaf + openhtmltopdf). */
@Service
@Transactional(readOnly = true)
public class StaySummaryPdfService {

    private static final DateTimeFormatter DATE_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy").withZone(ZoneId.systemDefault());

    private static final Map<String, String> DISCHARGE_LABELS = Map.of(
            "DOMICILE", "Retour à domicile",
            "TRANSFERT_EXT", "Transfert externe",
            "CONTRE_AVIS", "Sortie contre avis médical",
            "DECES", "Décès");

    private final StayService stayService;
    private final JdbcTemplate jdbc;
    private final TemplateEngine templateEngine;

    public StaySummaryPdfService(StayService stayService, JdbcTemplate jdbc, TemplateEngine templateEngine) {
        this.stayService = stayService;
        this.jdbc = jdbc;
        this.templateEngine = templateEngine;
    }

    public byte[] generate(UUID stayId) {
        StayDetailView s = stayService.get(stayId);

        Context ctx = new Context();
        ctx.setVariable("cabinet", fetchCabinet());
        ctx.setVariable("patient", Map.of("fullName", s.patientLastName() + " " + s.patientFirstName()));
        ctx.setVariable("stay", Map.of(
                "admittedAt", s.admittedAt() != null ? DATE_FMT.format(s.admittedAt()) : "—",
                "dischargedAt", s.dischargedAt() != null ? DATE_FMT.format(s.dischargedAt()) : "—",
                "dischargeType", s.dischargeType() != null
                        ? DISCHARGE_LABELS.getOrDefault(s.dischargeType(), s.dischargeType()) : "—",
                "reason", s.admissionReason() != null ? s.admissionReason() : "",
                "summary", s.dischargeSummary() != null ? s.dischargeSummary() : "",
                "total", s.chargeTotal().toPlainString()));

        List<Map<String, Object>> assignments = new ArrayList<>();
        for (StayDetailView.AssignmentView a : s.assignments()) {
            assignments.add(Map.of(
                    "label", a.bedLabel() != null ? a.bedLabel() : "—",
                    "nights", a.nights(),
                    "dailyRate", a.dailyRate().toPlainString(),
                    "lineTotal", a.dailyRate().multiply(BigDecimal.valueOf(a.nights())).toPlainString()));
        }
        ctx.setVariable("assignments", assignments);

        LogoBlob logo = fetchLogo();
        // QA10-1 — openhtmltopdf ignore l'opacité CSS sur les images raster : pour le
        // filigrane (WATERMARK) on cuit la transparence dans les octets PNG côté serveur,
        // comme PrescriptionPdfService. Sans ça le logo s'affichait en pleine opacité
        // (ou pas du tout) au lieu d'un fond léger.
        if (logo != null && "WATERMARK".equals(logo.position())) {
            byte[] raw = Base64.getDecoder().decode(logo.base64());
            byte[] processed = LogoWatermarkRenderer.applyTransparency(raw, 0.10f);
            if (processed != null) {
                logo = new LogoBlob(
                        Base64.getEncoder().encodeToString(processed),
                        LogoWatermarkRenderer.WATERMARK_MIME,
                        logo.position());
            }
        }
        ctx.setVariable("cabinetLogoBase64", logo != null ? logo.base64() : null);
        ctx.setVariable("cabinetLogoMime", logo != null ? logo.mime() : null);
        ctx.setVariable("cabinetLogoPosition", logo != null ? logo.position() : null);
        ctx.setVariable("signatureBase64", null);
        ctx.setVariable("signatureMime", null);

        String html = templateEngine.process("hospitalisation-cr", ctx);
        XRLog.setLoggingEnabled(false);
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            org.jsoup.nodes.Document jsoupDoc = org.jsoup.Jsoup.parse(html);
            jsoupDoc.outputSettings().syntax(org.jsoup.nodes.Document.OutputSettings.Syntax.xml);
            org.w3c.dom.Document w3cDoc = new org.jsoup.helper.W3CDom().fromJsoup(jsoupDoc);
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withW3cDocument(w3cDoc, "/");
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du compte-rendu d'hospitalisation", e);
        }
    }

    private Map<String, String> fetchCabinet() {
        try {
            return jdbc.queryForObject(
                    "SELECT name, address, city, phone, COALESCE(inpe,'') AS inpe, COALESCE(cnom,'') AS cnom, "
                            + "COALESCE(establishment_type,'CLINIQUE') AS etype "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, n) -> Map.of(
                            "name", rs.getString("name") != null ? rs.getString("name") : "",
                            "address", rs.getString("address") != null ? rs.getString("address") : "",
                            "city", rs.getString("city") != null ? rs.getString("city") : "",
                            "phone", rs.getString("phone") != null ? rs.getString("phone") : "",
                            "inpe", rs.getString("inpe"),
                            "cnom", rs.getString("cnom"),
                            "establishmentTypeLabel", establishmentLabel(rs.getString("etype"))));
        } catch (EmptyResultDataAccessException e) {
            return Map.of("name", "Clinique", "address", "", "city", "", "phone", "",
                    "inpe", "", "cnom", "", "establishmentTypeLabel", "");
        }
    }

    private static String establishmentLabel(String type) {
        if (type == null) return "";
        return switch (type) {
            case "CABINET" -> "Cabinet";
            case "CLINIQUE" -> "Clinique";
            case "HOPITAL" -> "Hôpital";
            case "CENTRE_MEDICAL" -> "Centre médical";
            default -> "";
        };
    }

    private LogoBlob fetchLogo() {
        try {
            return jdbc.queryForObject(
                    "SELECT logo_blob, logo_mime, COALESCE(logo_position,'HEADER') AS pos "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, n) -> {
                        byte[] blob = rs.getBytes("logo_blob");
                        String mime = rs.getString("logo_mime");
                        if (blob == null || mime == null) return null;
                        return new LogoBlob(Base64.getEncoder().encodeToString(blob), mime, rs.getString("pos"));
                    });
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    @SuppressWarnings("unused")
    private static Instant nowPlaceholder() { return Instant.now(); }

    private record LogoBlob(String base64, String mime, String position) {}
}
