package ma.careplus.catalog.application;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import ma.careplus.catalog.domain.Medication;
import ma.careplus.catalog.domain.Prescription;
import ma.careplus.catalog.domain.PrescriptionLine;
import ma.careplus.catalog.domain.PrescriptionType;
import ma.careplus.catalog.infrastructure.persistence.MedicationRepository;
import ma.careplus.catalog.infrastructure.persistence.PrescriptionLineRepository;
import ma.careplus.catalog.infrastructure.persistence.PrescriptionRepository;
import ma.careplus.clinical.infrastructure.persistence.ConsultationRepository;
import ma.careplus.patient.application.PatientService;
import ma.careplus.patient.domain.Patient;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

/**
 * Generates ordonnance PDF using Thymeleaf + openhtmltopdf.
 * Cabinet settings are fetched from configuration_clinic_settings via JdbcTemplate;
 * falls back to dev placeholder values if no row exists.
 *
 * Convention note: PatientRepository and ConsultationRepository are accessed
 * directly here (same reason as PrescriptionService — circular service dependency
 * avoidance). Post-MVP: introduce query facades per module boundary.
 */
@Service
@Transactional(readOnly = true)
public class PrescriptionPdfService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionLineRepository prescriptionLineRepository;
    private final MedicationRepository medicationRepository;
    private final ConsultationRepository consultationRepository;
    private final PatientService patientService;
    private final JdbcTemplate jdbc;
    private final TemplateEngine templateEngine;

    public PrescriptionPdfService(PrescriptionRepository prescriptionRepository,
                                   PrescriptionLineRepository prescriptionLineRepository,
                                   MedicationRepository medicationRepository,
                                   ConsultationRepository consultationRepository,
                                   PatientService patientService,
                                   JdbcTemplate jdbc,
                                   TemplateEngine templateEngine) {
        this.prescriptionRepository = prescriptionRepository;
        this.prescriptionLineRepository = prescriptionLineRepository;
        this.medicationRepository = medicationRepository;
        this.consultationRepository = consultationRepository;
        this.patientService = patientService;
        this.jdbc = jdbc;
        this.templateEngine = templateEngine;
    }

    public byte[] generateOrdonnancePdf(UUID prescriptionId) {
        Prescription prescription = prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new NotFoundException(
                        "PRESCRIPTION_NOT_FOUND", "Ordonnance introuvable : " + prescriptionId));

        var consultation = consultationRepository.findById(prescription.getConsultationId())
                .orElseThrow(() -> new NotFoundException(
                        "CONSULT_NOT_FOUND", "Consultation introuvable"));

        UUID patientId = prescription.getPatientId() != null
                ? prescription.getPatientId()
                : consultation.getPatientId();
        Patient patient = patientService.getActive(patientId);

        List<PrescriptionLine> lines = prescriptionLineRepository
                .findByPrescriptionIdOrderBySortOrderAsc(prescriptionId);

        // Resolve medication names for lines
        List<Map<String, Object>> lineModels = lines.stream().map(line -> {
            Map<String, Object> m = new HashMap<>();
            if (line.getMedicationId() != null) {
                medicationRepository.findById(line.getMedicationId()).ifPresent(med ->
                        m.put("medicationName", med.getCommercialName()));
            }
            m.put("dosage", line.getDosage() != null ? line.getDosage() : line.getDose());
            m.put("frequency", line.getFrequency());
            m.put("duration", line.getDuration());
            m.put("instructions", line.getInstructions() != null ? line.getInstructions() : line.getNotes());
            m.put("quantity", line.getQuantity());
            m.put("freeText", line.getFreeText());
            return m;
        }).toList();

        // Cabinet settings — fallback to dev placeholders
        Map<String, String> cabinet = fetchCabinetSettings();

        // Practitioner name from identity_user
        String doctorName = fetchDoctorName(consultation.getPractitionerId());

        // Build Thymeleaf context
        Context ctx = new Context();
        ctx.setVariable("cabinet", cabinet);
        ctx.setVariable("doctor", Map.of("fullName", doctorName));
        ctx.setVariable("patient", Map.of(
                "fullName", patient.getFirstName() + " " + patient.getLastName().toUpperCase(),
                "birthDate", patient.getBirthDate() != null
                        ? patient.getBirthDate().format(DateTimeFormatter.ofPattern("dd/MM/yyyy")) : "",
                "cin", patient.getCin() != null ? patient.getCin() : ""
        ));
        ctx.setVariable("prescription", Map.of(
                "date", prescription.getIssuedAt() != null
                        ? prescription.getIssuedAt().format(DATE_FMT) : "",
                "type", typeLabel(prescription.getType())
        ));
        ctx.setVariable("lines", lineModels);
        ctx.setVariable("allergyOverride", prescription.isAllergyOverride());

        String html = templateEngine.process("ordonnance", ctx);

        // Silence openhtmltopdf verbose warnings
        XRLog.setLoggingEnabled(false);

        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            // Use jsoup to parse HTML5 → W3C Document so openhtmltopdf handles
            // HTML5 entities (&nbsp; etc.) without requiring an external DTD.
            org.jsoup.nodes.Document jsoupDoc = org.jsoup.Jsoup.parse(html);
            jsoupDoc.outputSettings().syntax(org.jsoup.nodes.Document.OutputSettings.Syntax.xml);
            org.w3c.dom.Document w3cDoc = new org.jsoup.helper.W3CDom().fromJsoup(jsoupDoc);

            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.withW3cDocument(w3cDoc, "/");
            builder.toStream(out);
            builder.run();
            return out.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Erreur lors de la génération du PDF de l'ordonnance", e);
        }
    }

    private Map<String, String> fetchCabinetSettings() {
        try {
            return jdbc.queryForObject(
                    "SELECT name, address, city, phone, COALESCE(inpe,'') AS inpe, COALESCE(cnom,'') AS cnom " +
                    "FROM configuration_clinic_settings LIMIT 1",
                    (rs, rowNum) -> Map.of(
                            "name", rs.getString("name"),
                            "address", rs.getString("address"),
                            "city", rs.getString("city"),
                            "phone", rs.getString("phone"),
                            "inpe", rs.getString("inpe"),
                            "cnom", rs.getString("cnom")
                    ));
        } catch (Exception e) {
            // TODO: replace with proper configuration service query post-MVP
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

    private String fetchDoctorName(UUID practitionerId) {
        try {
            return jdbc.queryForObject(
                    "SELECT first_name || ' ' || last_name FROM identity_user WHERE id = ?",
                    String.class, practitionerId);
        } catch (Exception e) {
            return "Dr.";
        }
    }

    private String typeLabel(PrescriptionType type) {
        if (type == null) return "ORDONNANCE";
        return switch (type) {
            case DRUG -> "ORDONNANCE";
            case LAB -> "BON D'ANALYSES";
            case IMAGING -> "BON DE RADIOLOGIE";
            case CERT -> "CERTIFICAT MÉDICAL";
            case SICK_LEAVE -> "ARRÊT DE TRAVAIL";
        };
    }
}
