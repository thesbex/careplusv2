package ma.careplus.consent.application;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import ma.careplus.shared.pdf.LogoWatermarkRenderer;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Génère le PDF du document de consentement patient.
 * Miroir de {@code PrescriptionPdfService} et {@code StaySummaryPdfService} :
 * Thymeleaf + openhtmltopdf, logo/watermark alpha-baked côté serveur.
 * QA9-13.
 */
@Service
@Transactional(readOnly = true)
public class ConsentPdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final JdbcTemplate jdbc;
    private final TemplateEngine templateEngine;

    public ConsentPdfService(JdbcTemplate jdbc, TemplateEngine templateEngine) {
        this.jdbc = jdbc;
        this.templateEngine = templateEngine;
    }

    /**
     * Génère les octets PDF du document de consentement.
     *
     * @param patientId identifiant du patient (pour lire CIN et nom)
     * @param title     titre du document (ex. "Consentement acte opératoire")
     * @param body      texte brut du consentement (après substitution des placeholders)
     * @return octets PDF
     */
    public byte[] generate(UUID patientId, String title, String body) {
        PatientInfo patient = fetchPatient(patientId);
        Map<String, String> cabinet = fetchCabinet();

        // Substitution des placeholders dans le body
        String resolvedBody = body
                .replace("{{patientNom}}", (patient.lastName() + " " + patient.firstName()).toUpperCase())
                .replace("{{patientCin}}", patient.cin() != null ? patient.cin() : "")
                .replace("{{dateJour}}", LocalDate.now().format(DATE_FMT))
                .replace("{{cabinet}}", cabinet.getOrDefault("name", ""));

        LogoBlob logo = fetchLogo();
        // QA10-1 pattern : openhtmltopdf ignore l'opacité CSS sur les rasters —
        // on cuit la transparence dans les octets PNG côté serveur pour le filigrane.
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

        // Signature du médecin — non applicable ici (consentement signé par le patient)
        // On laisse null pour que le template tombe sur le bloc "Date + Signature patient".

        Context ctx = new Context();
        ctx.setVariable("cabinet", cabinet);
        ctx.setVariable("title", title);
        ctx.setVariable("body", resolvedBody);
        ctx.setVariable("patient", Map.of(
                "fullName", (patient.lastName() + " " + patient.firstName()).toUpperCase(),
                "cin", patient.cin() != null ? patient.cin() : ""
        ));
        ctx.setVariable("dateJour", LocalDate.now().format(DATE_FMT));
        ctx.setVariable("cabinetLogoBase64", logo != null ? logo.base64() : null);
        ctx.setVariable("cabinetLogoMime", logo != null ? logo.mime() : null);
        ctx.setVariable("cabinetLogoPosition", logo != null ? logo.position() : null);

        String html = templateEngine.process("consentement", ctx);
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
            throw new RuntimeException("Erreur lors de la génération du PDF de consentement", e);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private record PatientInfo(String firstName, String lastName, String cin) {}

    private PatientInfo fetchPatient(UUID patientId) {
        try {
            return jdbc.queryForObject(
                    "SELECT first_name, last_name, cin FROM patient_patient WHERE id = ? AND deleted_at IS NULL",
                    (rs, n) -> new PatientInfo(
                            rs.getString("first_name"),
                            rs.getString("last_name"),
                            rs.getString("cin")),
                    patientId);
        } catch (EmptyResultDataAccessException e) {
            throw new ma.careplus.shared.error.BusinessException(
                    "PATIENT_NOT_FOUND", "Patient introuvable.",
                    org.springframework.http.HttpStatus.NOT_FOUND.value());
        }
    }

    private Map<String, String> fetchCabinet() {
        try {
            return jdbc.queryForObject(
                    "SELECT name, address, city, phone, "
                            + "COALESCE(inpe,'') AS inpe, COALESCE(cnom,'') AS cnom, "
                            + "COALESCE(establishment_type,'CABINET') AS etype "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, n) -> Map.of(
                            "name",    rs.getString("name")    != null ? rs.getString("name")    : "",
                            "address", rs.getString("address") != null ? rs.getString("address") : "",
                            "city",    rs.getString("city")    != null ? rs.getString("city")    : "",
                            "phone",   rs.getString("phone")   != null ? rs.getString("phone")   : "",
                            "inpe",    rs.getString("inpe"),
                            "cnom",    rs.getString("cnom"),
                            "establishmentTypeLabel", establishmentLabel(rs.getString("etype"))
                    ));
        } catch (EmptyResultDataAccessException e) {
            return Map.of("name", "Cabinet", "address", "", "city", "", "phone", "",
                    "inpe", "", "cnom", "", "establishmentTypeLabel", "Cabinet");
        }
    }

    private static String establishmentLabel(String type) {
        if (type == null) return "Cabinet";
        return switch (type) {
            case "CLINIQUE"      -> "Clinique";
            case "HOPITAL"       -> "Hôpital";
            case "CENTRE_MEDICAL"-> "Centre médical";
            default              -> "Cabinet";
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

    private record LogoBlob(String base64, String mime, String position) {}
}
