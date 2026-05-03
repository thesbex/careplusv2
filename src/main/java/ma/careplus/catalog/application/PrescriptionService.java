package ma.careplus.catalog.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.domain.Medication;
import ma.careplus.catalog.domain.Prescription;
import ma.careplus.catalog.domain.PrescriptionLine;
import ma.careplus.catalog.domain.PrescriptionType;
import ma.careplus.catalog.infrastructure.persistence.PrescriptionLineRepository;
import ma.careplus.catalog.infrastructure.persistence.PrescriptionRepository;
import ma.careplus.catalog.infrastructure.web.dto.PrescriptionLineRequest;
import ma.careplus.catalog.infrastructure.web.dto.PrescriptionRequest;
import ma.careplus.clinical.domain.Consultation;
import ma.careplus.clinical.domain.ConsultationStatus;
import ma.careplus.clinical.infrastructure.persistence.ConsultationRepository;
import ma.careplus.patient.application.PatientService;
import ma.careplus.patient.domain.Allergy;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Prescription write-side.
 * Cross-module calls: PatientService (public API) for allergy check.
 * Cross-module calls: ConsultationRepository — convention exception noted below.
 *
 * Convention note: direct ConsultationRepository access is used here to avoid
 * circular service dependencies (clinical → catalog for prescriptions,
 * catalog → clinical for consultation check). Post-MVP this should use a
 * ConsultationQueryFacade event or public interface. Logged in DECISIONS.md.
 */
@Service
@Transactional
public class PrescriptionService {

    private final PrescriptionRepository prescriptionRepository;
    private final PrescriptionLineRepository prescriptionLineRepository;
    private final ConsultationRepository consultationRepository;
    private final CatalogService catalogService;
    private final PatientService patientService;

    public PrescriptionService(PrescriptionRepository prescriptionRepository,
                               PrescriptionLineRepository prescriptionLineRepository,
                               ConsultationRepository consultationRepository,
                               CatalogService catalogService,
                               PatientService patientService) {
        this.prescriptionRepository = prescriptionRepository;
        this.prescriptionLineRepository = prescriptionLineRepository;
        this.consultationRepository = consultationRepository;
        this.catalogService = catalogService;
        this.patientService = patientService;
    }

    public Prescription createPrescription(UUID consultationId, PrescriptionRequest req, UUID createdBy) {
        // Load consultation — must be in BROUILLON status
        Consultation consultation = consultationRepository.findById(consultationId)
                .orElseThrow(() -> new NotFoundException(
                        "CONSULT_NOT_FOUND", "Consultation introuvable : " + consultationId));

        if (consultation.getStatus() != ConsultationStatus.BROUILLON) {
            throw new BusinessException(
                    "CONSULT_LOCKED",
                    "Les prescriptions ne peuvent être créées que sur une consultation en BROUILLON.",
                    HttpStatus.BAD_REQUEST.value());
        }

        PrescriptionType type;
        try {
            type = PrescriptionType.valueOf(req.type());
        } catch (IllegalArgumentException e) {
            throw new BusinessException(
                    "INVALID_PRESCRIPTION_TYPE",
                    "Type de prescription inconnu : " + req.type(),
                    HttpStatus.BAD_REQUEST.value());
        }

        // Allergy check for DRUG prescriptions
        if (type == PrescriptionType.DRUG && req.lines() != null) {
            UUID patientId = consultation.getPatientId();
            List<Allergy> allergies = patientService.getAllergies(patientId);

            for (PrescriptionLineRequest line : req.lines()) {
                if (line.medicationId() == null) continue;

                Medication med = catalogService.findMedicationById(line.medicationId())
                        .orElseThrow(() -> new NotFoundException(
                                "MED_NOT_FOUND",
                                "Médicament introuvable : " + line.medicationId()));

                if (!allergies.isEmpty()) {
                    for (Allergy allergy : allergies) {
                        if (isAllergyMatch(med, allergy)) {
                            if (!req.allergyOverride()) {
                                throw new AllergyConflictException(
                                        med.getCommercialName(), allergy.getSubstance());
                            }
                            // Override accepted — continue (audit logged implicitly via prescription flags)
                            break;
                        }
                    }
                }
            }
        }

        // Save prescription
        Prescription prescription = new Prescription();
        prescription.setConsultationId(consultationId);
        prescription.setPatientId(consultation.getPatientId());
        prescription.setType(type);
        prescription.setAllergyOverride(req.allergyOverride());
        prescription.setAllergyOverrideReason(req.allergyOverrideReason());
        prescription.setCreatedBy(createdBy);
        prescriptionRepository.save(prescription);

        // Save lines
        if (req.lines() != null) {
            int order = 0;
            for (PrescriptionLineRequest lineReq : req.lines()) {
                PrescriptionLine line = new PrescriptionLine();
                line.setPrescriptionId(prescription.getId());
                line.setMedicationId(lineReq.medicationId());
                line.setLabTestId(lineReq.labTestId());
                line.setImagingExamId(lineReq.imagingExamId());
                line.setFreeText(lineReq.freeText());
                line.setDosage(lineReq.dosage());
                line.setDose(lineReq.dosage()); // keep V001 dose column in sync
                line.setFrequency(lineReq.frequency());
                line.setDuration(lineReq.duration());
                line.setRoute(lineReq.route());
                line.setTiming(lineReq.timing());
                line.setQuantity(lineReq.quantity());
                line.setInstructions(lineReq.instructions());
                line.setSortOrder(order);
                line.setPosition(order);
                prescriptionLineRepository.save(line);
                order++;
            }
        }

        return prescription;
    }

    @Transactional(readOnly = true)
    public Prescription getPrescription(UUID prescriptionId) {
        return prescriptionRepository.findById(prescriptionId)
                .orElseThrow(() -> new NotFoundException(
                        "PRESCRIPTION_NOT_FOUND", "Ordonnance introuvable : " + prescriptionId));
    }

    @Transactional(readOnly = true)
    public List<Prescription> getPrescriptionsByConsultation(UUID consultationId) {
        return prescriptionRepository.findByConsultationIdOrderByIssuedAtDesc(consultationId);
    }

    @Transactional(readOnly = true)
    public List<PrescriptionLine> getLinesForPrescription(UUID prescriptionId) {
        return prescriptionLineRepository.findByPrescriptionIdOrderBySortOrderAsc(prescriptionId);
    }

    /**
     * Simple allergy conflict detection for MVP:
     * checks if the medication's commercial name or DCI contains the allergy
     * substance string (case-insensitive), OR if the allergy's atcTag matches
     * any of the medication's tags.
     */
    private boolean isAllergyMatch(Medication med, Allergy allergy) {
        String substance = allergy.getSubstance().toLowerCase();
        String name = med.getCommercialName().toLowerCase();
        String dci = med.getDci().toLowerCase();

        if (name.contains(substance) || substance.contains(name)) return true;
        if (dci.contains(substance) || substance.contains(dci)) return true;

        // ATC tag cross-reference
        if (allergy.getAtcTag() != null && med.getTags() != null) {
            String atcTag = allergy.getAtcTag().toLowerCase();
            String tags = med.getTags().toLowerCase();
            if (tags.contains(atcTag)) return true;
        }

        return false;
    }
}
