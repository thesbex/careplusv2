package ma.careplus.confrere.application;

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
 * Génère le PDF du courrier au confrère.
 *
 * <p>Miroir de {@link ma.careplus.consent.application.ConsentPdfService} pour
 * le header/logo/watermark, et de {@code PrescriptionPdfService} pour la
 * signature médecin. Template : {@code lettre-confrere.html}. QA9-10.
 */
@Service
@Transactional(readOnly = true)
public class ConfrereLetterPdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final JdbcTemplate jdbc;
    private final TemplateEngine templateEngine;

    public ConfrereLetterPdfService(JdbcTemplate jdbc, TemplateEngine templateEngine) {
        this.jdbc = jdbc;
        this.templateEngine = templateEngine;
    }

    /**
     * Génère les octets PDF du courrier au confrère.
     *
     * @param practitionerId identifiant du médecin émetteur (pour sa signature)
     * @param recipientName  nom du confrère destinataire
     * @param recipientSpecialty spécialité du confrère (peut être null)
     * @param recipientCity  ville du confrère (peut être null)
     * @param body           corps de la lettre (texte libre rédigé par le médecin)
     * @return octets PDF
     */
    public byte[] generate(UUID practitionerId,
                           String recipientName,
                           String recipientSpecialty,
                           String recipientCity,
                           String body) {

        Map<String, String> cabinet = fetchCabinet();
        DoctorInfo doctor = fetchDoctorInfo(practitionerId);
        LogoBlob logo = fetchLogo();
        SignatureBlob signature = fetchSignature(practitionerId);

        // Alpha-bake pour filigrane — openhtmltopdf ignore CSS opacity sur rasters
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

        Context ctx = new Context();
        ctx.setVariable("cabinet", cabinet);
        ctx.setVariable("doctor", Map.of("fullName", doctor.fullName()));
        ctx.setVariable("specialty", doctor.specialty());
        ctx.setVariable("recipientName", recipientName);
        ctx.setVariable("recipientSpecialty", recipientSpecialty);
        ctx.setVariable("recipientCity", recipientCity);
        ctx.setVariable("body", body);
        ctx.setVariable("dateJour", LocalDate.now().format(DATE_FMT));
        ctx.setVariable("cabinetLogoBase64", logo != null ? logo.base64() : null);
        ctx.setVariable("cabinetLogoMime", logo != null ? logo.mime() : null);
        ctx.setVariable("cabinetLogoPosition", logo != null ? logo.position() : null);
        ctx.setVariable("signatureBase64", signature != null ? signature.base64() : null);
        ctx.setVariable("signatureMime", signature != null ? signature.mime() : null);

        String html = templateEngine.process("lettre-confrere", ctx);
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
            throw new RuntimeException("Erreur lors de la génération du PDF courrier confrère", e);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private record DoctorInfo(String fullName, String specialty) {}

    private record LogoBlob(String base64, String mime, String position) {}

    private record SignatureBlob(String base64, String mime) {}

    private Map<String, String> fetchCabinet() {
        try {
            return jdbc.queryForObject(
                    "SELECT name, address, city, phone, "
                            + "COALESCE(inpe,'') AS inpe, COALESCE(cnom,'') AS cnom, "
                            + "COALESCE(establishment_type,'CABINET') AS etype "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, n) -> Map.of(
                            "name",    nvl(rs.getString("name")),
                            "address", nvl(rs.getString("address")),
                            "city",    nvl(rs.getString("city")),
                            "phone",   nvl(rs.getString("phone")),
                            "inpe",    rs.getString("inpe"),
                            "cnom",    rs.getString("cnom"),
                            "establishmentTypeLabel", establishmentLabel(rs.getString("etype"))
                    ));
        } catch (EmptyResultDataAccessException e) {
            return Map.of("name", "Cabinet", "address", "", "city", "", "phone", "",
                    "inpe", "", "cnom", "", "establishmentTypeLabel", "Cabinet");
        }
    }

    private DoctorInfo fetchDoctorInfo(UUID practitionerId) {
        if (practitionerId == null) return new DoctorInfo("Dr.", null);
        try {
            return jdbc.queryForObject(
                    "SELECT first_name, last_name, specialty FROM identity_user WHERE id = ?",
                    (rs, i) -> new DoctorInfo(
                            "Dr. " + rs.getString("first_name") + " " + rs.getString("last_name"),
                            rs.getString("specialty")),
                    practitionerId);
        } catch (Exception e) {
            return new DoctorInfo("Dr.", null);
        }
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
                        return new LogoBlob(Base64.getEncoder().encodeToString(blob), mime,
                                rs.getString("pos"));
                    });
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private SignatureBlob fetchSignature(UUID practitionerId) {
        if (practitionerId == null) return null;
        try {
            return jdbc.queryForObject(
                    "SELECT signature_blob, signature_mime FROM identity_user WHERE id = ?",
                    (rs, i) -> {
                        byte[] blob = rs.getBytes("signature_blob");
                        String mime = rs.getString("signature_mime");
                        if (blob == null || mime == null) return null;
                        return new SignatureBlob(Base64.getEncoder().encodeToString(blob), mime);
                    },
                    practitionerId);
        } catch (Exception e) {
            return null;
        }
    }

    private static String establishmentLabel(String type) {
        if (type == null) return "Cabinet";
        return switch (type) {
            case "CLINIQUE"       -> "Clinique";
            case "HOPITAL"        -> "Hôpital";
            case "CENTRE_MEDICAL" -> "Centre médical";
            default               -> "Cabinet";
        };
    }

    private static String nvl(String s) {
        return s != null ? s : "";
    }
}
