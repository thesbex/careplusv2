package ma.careplus.vaccination.application;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.shared.error.NotFoundException;
import ma.careplus.vaccination.domain.VaccinationDose;
import ma.careplus.vaccination.domain.VaccinationStatus;
import ma.careplus.vaccination.domain.VaccineCatalog;
import ma.careplus.vaccination.infrastructure.persistence.VaccinationDoseRepository;
import ma.careplus.vaccination.infrastructure.persistence.VaccineCatalogRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Generates the vaccination booklet PDF for a patient.
 *
 * <p>Pattern: Thymeleaf + openhtmltopdf + jsoup — strictly aligned on
 * {@link ma.careplus.catalog.application.PrescriptionPdfService}.
 * Same HTML5 → W3C Document pipeline, same cabinet settings fetch, same
 * doctor name fetch. No new PDF library introduced.
 *
 * <p>Cross-module read on PatientRepository: accepted exception per project
 * convention (same as PrescriptionPdfService, BillingService, etc.).
 */
@Service
@Transactional(readOnly = true)
public class VaccinationBookletPdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PatientRepository patientRepo;
    private final VaccinationDoseRepository doseRepo;
    private final VaccineCatalogRepository catalogRepo;
    private final JdbcTemplate jdbc;
    private final TemplateEngine templateEngine;

    public VaccinationBookletPdfService(
            PatientRepository patientRepo,
            VaccinationDoseRepository doseRepo,
            VaccineCatalogRepository catalogRepo,
            JdbcTemplate jdbc,
            TemplateEngine templateEngine) {
        this.patientRepo = patientRepo;
        this.doseRepo = doseRepo;
        this.catalogRepo = catalogRepo;
        this.jdbc = jdbc;
        this.templateEngine = templateEngine;
    }

    /**
     * Generates a vaccination booklet PDF for the given patient.
     *
     * <p>If the patient has no ADMINISTERED doses, the PDF is still generated
     * with an empty table and the patient identity block. Never returns 404 here
     * (caller throws NotFoundException if patient unknown before calling this method).
     *
     * @param patientId patient UUID (active or soft-deleted — must be findable by id)
     * @return PDF bytes starting with "%PDF-"
     * @throws NotFoundException if patient not found at all
     */
    public byte[] generate(UUID patientId) {
        Patient patient = patientRepo.findById(patientId)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND",
                        "Patient introuvable : " + patientId));

        // Only ADMINISTERED doses, sorted by administeredAt ASC
        List<VaccinationDose> doses = doseRepo.findByPatientIdAndDeletedAtIsNull(patientId)
                .stream()
                .filter(d -> d.getStatus() == VaccinationStatus.ADMINISTERED
                        && d.getAdministeredAt() != null)
                .sorted(Comparator.comparing(VaccinationDose::getAdministeredAt))
                .toList();

        // Build dose rows for template
        List<Map<String, Object>> doseRows = new ArrayList<>();
        for (VaccinationDose dose : doses) {
            Map<String, Object> row = new HashMap<>();
            // Vaccine name
            catalogRepo.findById(dose.getVaccineId()).ifPresent(cat -> {
                row.put("vaccineName", cat.getNameFr());
                row.put("vaccineCode", cat.getCode());
            });
            row.put("doseNumber", dose.getDoseNumber());
            row.put("administeredAt",
                    dose.getAdministeredAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")));
            row.put("lotNumber", dose.getLotNumber() != null ? dose.getLotNumber() : "");
            row.put("route", dose.getRoute() != null ? dose.getRoute().name() : "");
            row.put("site", dose.getSite() != null ? dose.getSite() : "");
            // Administered by — resolve user name via JDBC
            if (dose.getAdministeredBy() != null) {
                String name = fetchUserName(dose.getAdministeredBy());
                row.put("administeredByName", name);
            } else {
                row.put("administeredByName", "");
            }
            doseRows.add(row);
        }

        // Cabinet settings
        Map<String, String> cabinet = fetchCabinetSettings();

        // Doctor name — try to get practitioner; fallback
        String doctorName = fetchDoctorName();

        // Patient identity
        LocalDate birthDate = patient.getBirthDate();
        String age = birthDate != null ? computeAgeLabel(birthDate) : "";
        String genderLabel = genderLabel(patient.getGender());

        Context ctx = new Context();
        ctx.setVariable("cabinet", cabinet);
        ctx.setVariable("doctor", Map.of("fullName", doctorName));
        ctx.setVariable("patient", Map.of(
                "fullName", patient.getFirstName() + " " + patient.getLastName().toUpperCase(),
                "birthDate", birthDate != null ? birthDate.format(DATE_FMT) : "",
                "age", age,
                "gender", genderLabel,
                "photoDocumentId", patient.getPhotoDocumentId() != null
                        ? patient.getPhotoDocumentId().toString() : ""
        ));
        ctx.setVariable("doses", doseRows);
        ctx.setVariable("generatedDate", LocalDate.now().format(DATE_FMT));

        String html = templateEngine.process("vaccination-booklet", ctx);

        XRLog.setLoggingEnabled(false);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            org.jsoup.nodes.Document jsoupDoc = org.jsoup.Jsoup.parse(html);
            jsoupDoc.outputSettings()
                    .syntax(org.jsoup.nodes.Document.OutputSettings.Syntax.xml);
            org.w3c.dom.Document w3cDoc = new org.jsoup.helper.W3CDom().fromJsoup(jsoupDoc);

            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withW3cDocument(w3cDoc, "/");
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du carnet vaccinal", e);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private helpers — strictly aligned with PrescriptionPdfService pattern
    // ─────────────────────────────────────────────────────────────────────────

    private Map<String, String> fetchCabinetSettings() {
        try {
            return jdbc.queryForObject(
                    "SELECT name, address, city, phone, "
                    + "COALESCE(inpe,'') AS inpe, COALESCE(cnom,'') AS cnom "
                    + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, rowNum) -> Map.of(
                            "name", rs.getString("name"),
                            "address", rs.getString("address"),
                            "city", rs.getString("city"),
                            "phone", rs.getString("phone"),
                            "inpe", rs.getString("inpe"),
                            "cnom", rs.getString("cnom")
                    ));
        } catch (Exception e) {
            return Map.of(
                    "name", "Cabinet Médical CarePlus",
                    "address", "123 Boulevard Mohamed V",
                    "city", "Casablanca",
                    "phone", "+212 5 22 00 00 00",
                    "inpe", "",
                    "cnom", ""
            );
        }
    }

    private String fetchDoctorName() {
        try {
            // Fetch the first MEDECIN user as default doctor name for the booklet header
            return jdbc.queryForObject(
                    "SELECT u.first_name || ' ' || u.last_name "
                    + "FROM identity_user u "
                    + "JOIN identity_user_role ur ON ur.user_id = u.id "
                    + "JOIN identity_role r ON r.id = ur.role_id "
                    + "WHERE r.name = 'MEDECIN' AND u.enabled = TRUE "
                    + "ORDER BY u.created_at LIMIT 1",
                    String.class);
        } catch (Exception e) {
            return "Dr.";
        }
    }

    private String fetchUserName(UUID userId) {
        try {
            return jdbc.queryForObject(
                    "SELECT first_name || ' ' || last_name FROM identity_user WHERE id = ?",
                    String.class, userId);
        } catch (Exception e) {
            return "";
        }
    }

    private static String computeAgeLabel(LocalDate birthDate) {
        LocalDate today = LocalDate.now();
        long months = java.time.temporal.ChronoUnit.MONTHS.between(birthDate, today);
        if (months < 24) {
            return months + " mois";
        }
        long years = java.time.temporal.ChronoUnit.YEARS.between(birthDate, today);
        return years + " ans";
    }

    private static String genderLabel(String gender) {
        if (gender == null) return "";
        return switch (gender) {
            case "M" -> "Masculin";
            case "F" -> "Féminin";
            default  -> "";
        };
    }
}
