package ma.careplus.patient.application;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.shared.pdf.LogoWatermarkRenderer;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Génère la « Synthèse patient » imprimable (bouton Imprimer du dossier).
 *
 * <p>Pattern strictement aligné sur {@link ma.careplus.vaccination.application.VaccinationBookletPdfService}
 * (Thymeleaf + openhtmltopdf + jsoup, mêmes helpers cabinet/logo). Aucune
 * nouvelle dépendance PDF. Toutes les lectures passent par {@link JdbcTemplate}
 * pour éviter tout couplage repository inter-module (allergies/antécédents sont
 * dans le module patient ; les consultations dans le module clinical — lues en
 * SQL comme la signature/identity dans le service vaccination).
 *
 * <p>Document interne (résumé de dossier) : pas de bloc signature médecin.
 */
@Service
@Transactional(readOnly = true)
public class PatientSynthesePdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final PatientRepository patientRepo;
    private final JdbcTemplate jdbc;
    private final TemplateEngine templateEngine;

    public PatientSynthesePdfService(PatientRepository patientRepo,
                                     JdbcTemplate jdbc,
                                     TemplateEngine templateEngine) {
        this.patientRepo = patientRepo;
        this.jdbc = jdbc;
        this.templateEngine = templateEngine;
    }

    /**
     * @param patientId patient UUID
     * @return PDF bytes (commencent par "%PDF-")
     * @throws NotFoundException si patient inconnu
     */
    public byte[] generate(UUID patientId) {
        Patient patient = patientRepo.findById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        List<Map<String, Object>> allergies = jdbc.query(
                "SELECT substance, severity, COALESCE(notes,'') AS notes "
                + "FROM patient_allergy WHERE patient_id = ? ORDER BY created_at",
                (rs, i) -> Map.of(
                        "substance", rs.getString("substance"),
                        "severity", severityLabel(rs.getString("severity")),
                        "notes", rs.getString("notes")),
                patientId);

        List<Map<String, Object>> antecedents = jdbc.query(
                "SELECT type, description, occurred_on "
                + "FROM patient_antecedent WHERE patient_id = ? ORDER BY type, created_at",
                (rs, i) -> {
                    java.sql.Date d = rs.getDate("occurred_on");
                    return Map.of(
                            "type", antecedentTypeLabel(rs.getString("type")),
                            "description", rs.getString("description"),
                            "date", d != null ? d.toLocalDate().format(DATE_FMT) : "");
                },
                patientId);

        // Consultations récentes (20 dernières), avec nom du médecin (lecture SQL inter-module).
        List<Map<String, Object>> consultations = jdbc.query(
                "SELECT c.started_at, COALESCE(c.motif,'') AS motif, COALESCE(c.diagnosis,'') AS diagnosis, "
                + "c.status, (u.first_name || ' ' || u.last_name) AS practitioner "
                + "FROM clinical_consultation c "
                + "LEFT JOIN identity_user u ON u.id = c.practitioner_id "
                + "WHERE c.patient_id = ? ORDER BY c.started_at DESC LIMIT 20",
                (rs, i) -> {
                    java.time.Instant started = rs.getTimestamp("started_at").toInstant();
                    return Map.of(
                            "date", started.atZone(java.time.ZoneId.systemDefault())
                                    .toLocalDateTime().format(DATETIME_FMT),
                            "motif", rs.getString("motif"),
                            "diagnosis", rs.getString("diagnosis"),
                            "status", consultationStatusLabel(rs.getString("status")),
                            "practitioner", rs.getString("practitioner") != null
                                    ? rs.getString("practitioner") : "");
                },
                patientId);

        Map<String, String> cabinet = fetchCabinetSettings();
        DoctorInfo doctor = fetchDoctorInfo();

        LogoBlob logo = fetchClinicLogoBlob();
        String logoPosition = fetchLogoPosition();
        if (logo != null && "WATERMARK".equals(logoPosition)) {
            logo = applyWatermarkAlpha(logo);
        }

        LocalDate birthDate = patient.getBirthDate();

        Context ctx = new Context();
        ctx.setVariable("cabinet", cabinet);
        ctx.setVariable("doctor", Map.of("fullName", doctor.fullName()));
        ctx.setVariable("specialty", doctor.specialty());
        ctx.setVariable("cabinetLogoBase64", logo != null ? logo.base64() : null);
        ctx.setVariable("cabinetLogoMime", logo != null ? logo.mime() : null);
        ctx.setVariable("cabinetLogoPosition", logoPosition);
        ctx.setVariable("patient", Map.of(
                "fullName", patient.getFirstName() + " " + patient.getLastName().toUpperCase(),
                "birthDate", birthDate != null ? birthDate.format(DATE_FMT) : "",
                "age", birthDate != null ? computeAgeLabel(birthDate) : "",
                "gender", genderLabel(patient.getGender()),
                "cin", patient.getCin() != null ? patient.getCin() : "",
                "phone", patient.getPhone() != null ? patient.getPhone() : "",
                "bloodGroup", patient.getBloodGroup() != null ? patient.getBloodGroup() : ""));
        ctx.setVariable("allergies", allergies);
        ctx.setVariable("antecedents", antecedents);
        ctx.setVariable("consultations", consultations);
        ctx.setVariable("generatedDate", LocalDate.now().format(DATE_FMT));

        String html = templateEngine.process("patient-synthese", ctx);
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
            throw new RuntimeException("Erreur lors de la génération de la synthèse patient", e);
        }
    }

    // ── Helpers (alignés sur VaccinationBookletPdfService) ───────────────────────

    private record LogoBlob(String base64, String mime) {}

    private LogoBlob fetchClinicLogoBlob() {
        try {
            return jdbc.queryForObject(
                    "SELECT logo_blob, logo_mime FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        byte[] blob = rs.getBytes("logo_blob");
                        String mime = rs.getString("logo_mime");
                        if (blob == null || mime == null) return null;
                        return new LogoBlob(Base64.getEncoder().encodeToString(blob), mime);
                    });
        } catch (Exception e) {
            return null;
        }
    }

    private LogoBlob applyWatermarkAlpha(LogoBlob source) {
        byte[] raw = Base64.getDecoder().decode(source.base64());
        byte[] processed = LogoWatermarkRenderer.applyTransparency(raw, 0.10f);
        if (processed == null) return source;
        return new LogoBlob(Base64.getEncoder().encodeToString(processed),
                LogoWatermarkRenderer.WATERMARK_MIME);
    }

    private String fetchLogoPosition() {
        try {
            String pos = jdbc.queryForObject(
                    "SELECT logo_position FROM configuration_clinic_settings LIMIT 1", String.class);
            return pos != null ? pos : "HEADER";
        } catch (Exception e) {
            return "HEADER";
        }
    }

    private Map<String, String> fetchCabinetSettings() {
        try {
            return jdbc.queryForObject(
                    "SELECT name, address, city, phone, "
                    + "COALESCE(inpe,'') AS inpe, COALESCE(cnom,'') AS cnom, "
                    + "COALESCE(establishment_type,'CABINET') AS etype "
                    + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, rowNum) -> Map.of(
                            "name", rs.getString("name"),
                            "address", rs.getString("address"),
                            "city", rs.getString("city"),
                            "phone", rs.getString("phone"),
                            "inpe", rs.getString("inpe"),
                            "cnom", rs.getString("cnom"),
                            "establishmentType", rs.getString("etype"),
                            "establishmentTypeLabel", establishmentTypeLabel(rs.getString("etype"))));
        } catch (Exception e) {
            return Map.of(
                    "name", "Médical CarePlus",
                    "address", "123 Boulevard Mohamed V",
                    "city", "Casablanca",
                    "phone", "+212 5 22 00 00 00",
                    "inpe", "",
                    "cnom", "",
                    "establishmentType", "CABINET",
                    "establishmentTypeLabel", "Cabinet");
        }
    }

    private static String establishmentTypeLabel(String type) {
        if (type == null) return "Cabinet";
        return switch (type) {
            case "CLINIQUE" -> "Clinique";
            case "HOPITAL" -> "Hôpital";
            case "CENTRE_MEDICAL" -> "Centre médical";
            case "AUTRE" -> "";
            default -> "Cabinet";
        };
    }

    private record DoctorInfo(UUID userId, String fullName, String specialty) {}

    private DoctorInfo fetchDoctorInfo() {
        try {
            return jdbc.queryForObject(
                    "SELECT u.id, u.first_name, u.last_name, u.specialty "
                    + "FROM identity_user u "
                    + "JOIN identity_user_role ur ON ur.user_id = u.id "
                    + "JOIN identity_role r ON r.id = ur.role_id "
                    + "WHERE r.code = 'MEDECIN' AND u.enabled = TRUE "
                    + "ORDER BY u.created_at LIMIT 1",
                    (rs, i) -> new DoctorInfo(
                            (UUID) rs.getObject("id"),
                            rs.getString("first_name") + " " + rs.getString("last_name"),
                            rs.getString("specialty")));
        } catch (Exception e) {
            return new DoctorInfo(null, "Dr.", null);
        }
    }

    private static String computeAgeLabel(LocalDate birthDate) {
        LocalDate today = LocalDate.now();
        long months = java.time.temporal.ChronoUnit.MONTHS.between(birthDate, today);
        if (months < 24) return months + " mois";
        return java.time.temporal.ChronoUnit.YEARS.between(birthDate, today) + " ans";
    }

    private static String genderLabel(String gender) {
        if (gender == null) return "";
        return switch (gender) {
            case "M" -> "Masculin";
            case "F" -> "Féminin";
            default -> "";
        };
    }

    private static String severityLabel(String severity) {
        if (severity == null) return "";
        return switch (severity) {
            case "LEGERE" -> "Légère";
            case "MODEREE" -> "Modérée";
            case "SEVERE" -> "Sévère";
            default -> severity;
        };
    }

    private static String antecedentTypeLabel(String type) {
        if (type == null) return "";
        return switch (type) {
            case "MEDICAL" -> "Médical";
            case "CHIRURGICAL" -> "Chirurgical";
            case "FAMILIAL" -> "Familial";
            case "GYNECO_OBSTETRIQUE" -> "Gynéco-obstétrique";
            case "HABITUS" -> "Habitus";
            default -> type;
        };
    }

    private static String consultationStatusLabel(String status) {
        if (status == null) return "";
        return switch (status) {
            case "BROUILLON" -> "Brouillon";
            case "SUSPENDUE" -> "Suspendue";
            case "SIGNEE" -> "Signée";
            case "AMENDEE" -> "Amendée";
            default -> status;
        };
    }
}
