package ma.careplus.catalog.application;

import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.openhtmltopdf.util.XRLog;
import java.io.ByteArrayOutputStream;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
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

        // Resolve medication / lab test / imaging exam names for lines.
        //
        // Toutes les clés (medicationName, labTestName, imagingExamName) doivent
        // toujours être présentes — y compris null — sous peine de faire planter
        // Thymeleaf : `line.medicationName != null` lève EL1008E quand la clé
        // n'est pas dans la HashMap (le SpringEL retombe sur ReflectivePropertyAccessor
        // sur HashMap qui n'expose pas de getter `medicationName`). Symptôme
        // historique : "Impossible de charger le PDF" pour un bon d'analyses.
        List<Map<String, Object>> lineModels = lines.stream().map(line -> {
            Map<String, Object> m = new HashMap<>();
            m.put("medicationName", null);
            m.put("labTestName", null);
            m.put("imagingExamName", null);
            if (line.getMedicationId() != null) {
                medicationRepository.findById(line.getMedicationId()).ifPresent(med ->
                        m.put("medicationName", med.getCommercialName()));
            }
            if (line.getLabTestId() != null) {
                m.put("labTestName", fetchLabTestName(line.getLabTestId()));
            }
            if (line.getImagingExamId() != null) {
                m.put("imagingExamName", fetchImagingExamName(line.getImagingExamId()));
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

        // Practitioner name + specialty from identity_user
        DoctorInfo doctor = fetchDoctorInfo(consultation.getPractitionerId());

        // F16 — signature médecin (optionnelle ; null si non configurée).
        // V035 : la signature est désormais associée au médecin (pas au cabinet),
        // donc on la charge à partir de l'ID praticien de la consultation.
        SignatureBlob signature = fetchSignatureBlob(consultation.getPractitionerId());

        // V037 — logo établissement (optionnel). Pattern identique à la signature :
        // base64 + MIME injectés en variables Thymeleaf, le template fait la
        // condition (logo absent → fallback texte seul).
        SignatureBlob logo = fetchClinicLogoBlob();

        // Build Thymeleaf context
        Context ctx = new Context();
        ctx.setVariable("cabinet", cabinet);
        ctx.setVariable("doctor", Map.of("fullName", doctor.fullName()));
        // V032 — specialty injectée à part : Map.of n'accepte pas de valeur null,
        // donc on la pousse comme variable racine et le template la lit conditionnellement.
        ctx.setVariable("specialty", doctor.specialty());
        ctx.setVariable("signatureBase64", signature != null ? signature.base64() : null);
        ctx.setVariable("signatureMime", signature != null ? signature.mime() : null);
        ctx.setVariable("cabinetLogoBase64", logo != null ? logo.base64() : null);
        ctx.setVariable("cabinetLogoMime", logo != null ? logo.mime() : null);
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

        // Pour les types CERT et SICK_LEAVE, on rend un template "certificat"
        // (mise en page formelle "Je soussigné…"). Les autres types (DRUG /
        // LAB / IMAGING) gardent le template ordonnance avec lignes numérotées.
        String templateName = switch (prescription.getType()) {
            case CERT, SICK_LEAVE -> "certificat";
            default -> "ordonnance";
        };
        String html = templateEngine.process(templateName, ctx);

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

    /**
     * Résout le nom d'un examen biologique. Les analyses ne sont pas mappées
     * en JPA (accès brut JdbcTemplate dans CatalogController) — on lit donc
     * la même table ici. Renvoie null si l'examen a été supprimé / désactivé.
     */
    private String fetchLabTestName(UUID labTestId) {
        try {
            return jdbc.queryForObject(
                    "SELECT name FROM catalog_lab_test WHERE id = ?",
                    String.class, labTestId);
        } catch (Exception e) {
            return null;
        }
    }

    /** Idem pour les examens d'imagerie. */
    private String fetchImagingExamName(UUID imagingExamId) {
        try {
            return jdbc.queryForObject(
                    "SELECT name FROM catalog_imaging_exam WHERE id = ?",
                    String.class, imagingExamId);
        } catch (Exception e) {
            return null;
        }
    }

    /** Holder interne pour la signature médecin lue en base. */
    private record SignatureBlob(String base64, String mime) {}

    /**
     * F16 + V035 — lit la signature scannée du médecin depuis
     * {@code identity_user.signature_blob} (per-praticien depuis 2026-05-08)
     * et l'encode en base64 pour l'embed direct dans le HTML (data URL).
     * Renvoie {@code null} si la colonne est NULL — le template tombe alors
     * back sur le cachet texte.
     */
    private SignatureBlob fetchSignatureBlob(UUID practitionerId) {
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

    /**
     * V037 — lit le logo de l'établissement depuis
     * {@code configuration_clinic_settings.logo_blob} et l'encode en base64
     * pour l'embed direct dans le HTML (data URL). Renvoie {@code null} si
     * la colonne est NULL — le template tombe alors sur le rendu texte seul.
     * Réutilise le record {@link SignatureBlob} (juste un container base64+mime).
     */
    private SignatureBlob fetchClinicLogoBlob() {
        try {
            return jdbc.queryForObject(
                    "SELECT logo_blob, logo_mime FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        byte[] blob = rs.getBytes("logo_blob");
                        String mime = rs.getString("logo_mime");
                        if (blob == null || mime == null) return null;
                        return new SignatureBlob(Base64.getEncoder().encodeToString(blob), mime);
                    });
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, String> fetchCabinetSettings() {
        try {
            return jdbc.queryForObject(
                    "SELECT name, address, city, phone, COALESCE(inpe,'') AS inpe, COALESCE(cnom,'') AS cnom, "
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
                            "establishmentTypeLabel", establishmentTypeLabel(rs.getString("etype"))
                    ));
        } catch (Exception e) {
            // TODO: replace with proper configuration service query post-MVP
            return Map.of(
                    "name", "Médical CarePlus",
                    "address", "123 Boulevard Mohamed V",
                    "city", "Casablanca",
                    "phone", "+212 5 22 00 00 00",
                    "inpe", "",
                    "cnom", "",
                    "establishmentType", "CABINET",
                    "establishmentTypeLabel", "Cabinet"
            );
        }
    }

    /**
     * Affichage humain du type d'établissement, utilisé en préfixe avant le nom
     * dans l'en-tête du PDF (ex. "Clinique El Amrani"). 'AUTRE' rend chaîne vide
     * pour ne pas polluer le rendu si l'admin n'a pas su catégoriser.
     */
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

    /** V032 — bundle holder for the practitioner full name + specialty. */
    private record DoctorInfo(String fullName, String specialty) {}

    private DoctorInfo fetchDoctorInfo(UUID practitionerId) {
        try {
            return jdbc.queryForObject(
                    "SELECT first_name, last_name, specialty FROM identity_user WHERE id = ?",
                    (rs, i) -> new DoctorInfo(
                            rs.getString("first_name") + " " + rs.getString("last_name"),
                            rs.getString("specialty")),
                    practitionerId);
        } catch (Exception e) {
            return new DoctorInfo("Dr.", null);
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
