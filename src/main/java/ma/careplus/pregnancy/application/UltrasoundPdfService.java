package ma.careplus.pregnancy.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import ma.careplus.pregnancy.domain.PregnancyUltrasound;
import ma.careplus.pregnancy.domain.UltrasoundKind;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyUltrasoundRepository;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.shared.pdf.LogoWatermarkRenderer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Génère le PDF du compte-rendu d'échographie obstétricale.
 *
 * <p>Miroir de {@link ma.careplus.confrere.application.ConfrereLetterPdfService} :
 * même pipeline Thymeleaf + openhtmltopdf, même alpha-bake du watermark.
 * Template : {@code echographie-cr.html}.
 *
 * <p>Données lues :
 * <ul>
 *   <li>{@code pregnancy_ultrasound} — l'écho (kind, performedAt, sa*, biometryJson, findings)</li>
 *   <li>{@code pregnancy} — la grossesse (dueDate)</li>
 *   <li>{@code patient_patient} — nom + CIN de la patiente</li>
 *   <li>{@code configuration_clinic_settings} — cabinet + logo</li>
 *   <li>{@code identity_user} — médecin (nom + signature)</li>
 * </ul>
 */
@Service
@Transactional(readOnly = true)
public class UltrasoundPdfService {

    private static final Logger log = LoggerFactory.getLogger(UltrasoundPdfService.class);
    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PregnancyUltrasoundRepository ultrasoundRepo;
    private final JdbcTemplate jdbc;
    private final TemplateEngine templateEngine;
    private final ObjectMapper objectMapper;

    public UltrasoundPdfService(PregnancyUltrasoundRepository ultrasoundRepo,
                                JdbcTemplate jdbc,
                                TemplateEngine templateEngine,
                                ObjectMapper objectMapper) {
        this.ultrasoundRepo = ultrasoundRepo;
        this.jdbc = jdbc;
        this.templateEngine = templateEngine;
        this.objectMapper = objectMapper;
    }

    /**
     * Génère les octets PDF du compte-rendu d'échographie.
     *
     * @param ultrasoundId   identifiant de l'échographie
     * @param pregnancyId    identifiant de la grossesse (pour validation appartenance)
     * @param practitionerId identifiant du médecin émetteur (signature)
     * @return octets PDF
     * @throws NotFoundException si l'échographie n'existe pas ou n'appartient pas à la grossesse
     */
    public byte[] generate(UUID ultrasoundId, UUID pregnancyId, UUID practitionerId) {

        PregnancyUltrasound echo = ultrasoundRepo.findById(ultrasoundId)
                .filter(u -> u.getPregnancyId().equals(pregnancyId))
                .orElseThrow(() -> new NotFoundException("ULTRASOUND_NOT_FOUND",
                        "Échographie introuvable : " + ultrasoundId));

        // Pregnancy — due date
        LocalDate dueDate = fetchDueDate(pregnancyId);

        // Patient — nom + CIN (via pregnancy.patient_id)
        PatientInfo patient = fetchPatient(pregnancyId);

        // Cabinet
        Map<String, String> cabinet = fetchCabinet();

        // Doctor
        DoctorInfo doctor = fetchDoctorInfo(practitionerId);

        // Logo (with watermark alpha-bake)
        LogoBlob logo = fetchLogo();
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

        // Signature
        SignatureBlob signature = fetchSignature(practitionerId);

        // Biometry map (tolerates missing / null keys)
        Map<String, String> biometryMap = parseBiometry(echo.getBiometryJson());

        // Build template context
        Context ctx = new Context();
        ctx.setVariable("cabinet", cabinet);
        ctx.setVariable("doctor", Map.of("fullName", doctor.fullName()));
        ctx.setVariable("specialty", doctor.specialty());

        ctx.setVariable("patient", Map.of(
                "fullName", (patient.lastName() + " " + patient.firstName()).toUpperCase(),
                "cin", patient.cin() != null ? patient.cin() : ""
        ));

        Map<String, String> exam = new LinkedHashMap<>();
        exam.put("kindLabel", kindLabel(echo.getKind()));
        exam.put("performedAt", echo.getPerformedAt().format(DATE_FMT));
        exam.put("terme", echo.getSaWeeksAtExam() + " SA + " + echo.getSaDaysAtExam() + " j");
        exam.put("dpa", dueDate != null ? dueDate.format(DATE_FMT) : null);
        exam.put("correctsDueDate", String.valueOf(echo.isCorrectsDueDate()));
        ctx.setVariable("exam", exam);

        ctx.setVariable("biometry", biometryMap);
        ctx.setVariable("findings", echo.getFindings());
        ctx.setVariable("dateJour", LocalDate.now().format(DATE_FMT));

        ctx.setVariable("cabinetLogoBase64", logo != null ? logo.base64() : null);
        ctx.setVariable("cabinetLogoMime", logo != null ? logo.mime() : null);
        ctx.setVariable("cabinetLogoPosition", logo != null ? logo.position() : null);
        ctx.setVariable("signatureBase64", signature != null ? signature.base64() : null);
        ctx.setVariable("signatureMime", signature != null ? signature.mime() : null);

        String html = templateEngine.process("echographie-cr", ctx);
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
            throw new RuntimeException("Erreur lors de la génération du PDF échographie CR", e);
        }
    }

    // ── Private records ───────────────────────────────────────────────────────

    private record PatientInfo(String firstName, String lastName, String cin) {}
    private record DoctorInfo(String fullName, String specialty) {}
    private record LogoBlob(String base64, String mime, String position) {}
    private record SignatureBlob(String base64, String mime) {}

    // ── JDBC helpers ──────────────────────────────────────────────────────────

    private LocalDate fetchDueDate(UUID pregnancyId) {
        try {
            return jdbc.queryForObject(
                    "SELECT due_date FROM pregnancy WHERE id = ?",
                    (rs, n) -> rs.getObject("due_date", LocalDate.class),
                    pregnancyId);
        } catch (EmptyResultDataAccessException e) {
            return null;
        }
    }

    private PatientInfo fetchPatient(UUID pregnancyId) {
        try {
            return jdbc.queryForObject(
                    "SELECT p.first_name, p.last_name, p.cin "
                            + "FROM patient_patient p "
                            + "JOIN pregnancy g ON g.patient_id = p.id "
                            + "WHERE g.id = ? AND p.deleted_at IS NULL",
                    (rs, n) -> new PatientInfo(
                            rs.getString("first_name"),
                            rs.getString("last_name"),
                            rs.getString("cin")),
                    pregnancyId);
        } catch (EmptyResultDataAccessException e) {
            return new PatientInfo("Patiente", "Inconnue", null);
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

    // ── Domain helpers ────────────────────────────────────────────────────────

    /**
     * Parses biometryJson into a String→String map for the template.
     * Missing or null keys are simply absent from the map (template skips them).
     * Tolerates null / blank / malformed JSON — returns an empty map.
     */
    private Map<String, String> parseBiometry(String biometryJson) {
        Map<String, String> result = new LinkedHashMap<>();
        if (biometryJson == null || biometryJson.isBlank()) return result;
        try {
            Map<String, Object> raw = objectMapper.readValue(biometryJson,
                    new TypeReference<Map<String, Object>>() {});
            for (String key : new String[]{"bip", "pc", "dat", "lf", "eg", "percentile"}) {
                Object v = raw.get(key);
                if (v != null) {
                    result.put(key, formatBiometryValue(v));
                }
            }
        } catch (Exception e) {
            log.warn("UltrasoundPdfService: impossible de parser biometryJson — {}", e.getMessage());
        }
        return result;
    }

    private String formatBiometryValue(Object v) {
        if (v instanceof Double d) {
            // Trim trailing .0 for whole numbers
            if (d == Math.floor(d) && !Double.isInfinite(d)) {
                return String.valueOf(d.intValue());
            }
            return String.valueOf(d);
        }
        return v.toString();
    }

    private static String kindLabel(UltrasoundKind kind) {
        if (kind == null) return "Échographie";
        return switch (kind) {
            case T1_DATATION   -> "Échographie de datation (T1)";
            case T2_MORPHO     -> "Échographie morphologique (T2)";
            case T3_CROISSANCE -> "Échographie de croissance (T3)";
            case AUTRE         -> "Échographie";
        };
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
