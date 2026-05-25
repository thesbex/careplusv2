package ma.careplus.clinical.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.clinical.domain.VitalSigns;
import ma.careplus.clinical.infrastructure.persistence.VitalSignsRepository;
import ma.careplus.clinical.infrastructure.web.dto.RecordVitalsRequest;
import ma.careplus.clinical.domain.Consultation;
import ma.careplus.clinical.infrastructure.persistence.ConsultationRepository;
import ma.careplus.scheduling.domain.Appointment;
import ma.careplus.scheduling.domain.AppointmentStatus;
import ma.careplus.scheduling.infrastructure.persistence.AppointmentRepository;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class VitalsService {

    private final VitalSignsRepository vitalsRepository;
    private final AppointmentRepository appointmentRepository;
    private final ConsultationRepository consultationRepository;

    public VitalsService(VitalSignsRepository vitalsRepository,
                         AppointmentRepository appointmentRepository,
                         ConsultationRepository consultationRepository) {
        this.vitalsRepository = vitalsRepository;
        this.appointmentRepository = appointmentRepository;
        this.consultationRepository = consultationRepository;
    }

    public VitalSigns record(UUID appointmentId, UUID recordedBy, RecordVitalsRequest req) {
        Appointment a = appointmentRepository.findById(appointmentId)
                .orElseThrow(() -> new NotFoundException(
                        "APPT_NOT_FOUND", "Rendez-vous introuvable : " + appointmentId));

        // Advance appointment status to CONSTANTES_PRISES (valid from ARRIVE /
        // EN_ATTENTE_CONSTANTES). Admin-compatible: later statuses may still
        // be recording correction vitals mid-consultation — allowed.
        if (a.getStatus() == AppointmentStatus.ARRIVE
                || a.getStatus() == AppointmentStatus.EN_ATTENTE_CONSTANTES) {
            a.setStatus(AppointmentStatus.CONSTANTES_PRISES);
        }

        VitalSigns v = new VitalSigns();
        v.setPatientId(a.getPatientId());
        v.setAppointmentId(a.getId());
        applyVitals(v, req);
        v.setRecordedBy(recordedBy);
        return vitalsRepository.save(v);
    }

    /**
     * Enregistre des constantes rattachées à une consultation directement
     * (sans passer par la salle d'attente). Utile pour une consultation
     * ad-hoc créée depuis le dossier sans rendez-vous.
     */
    public VitalSigns recordForConsultation(UUID consultationId, UUID recordedBy,
                                            RecordVitalsRequest req) {
        Consultation c = consultationRepository.findById(consultationId)
                .orElseThrow(() -> new NotFoundException(
                        "CONSULT_NOT_FOUND", "Consultation introuvable : " + consultationId));

        VitalSigns v = new VitalSigns();
        v.setPatientId(c.getPatientId());
        v.setAppointmentId(c.getAppointmentId()); // peut être null
        v.setConsultationId(c.getId());
        applyVitals(v, req);
        v.setRecordedBy(recordedBy);
        return vitalsRepository.save(v);
    }

    /**
     * Recopie tous les champs métier du DTO vers l'entité. Centralisé
     * pour éviter la duplication entre les 2 endpoints d'écriture
     * (appointment + consultation), qui était précisément la source de
     * B1 : un champ ajouté côté DTO mais oublié dans une seule des deux
     * branches → perte silencieuse.
     */
    private static void applyVitals(VitalSigns v, RecordVitalsRequest req) {
        v.setSystolicMmhg(req.systolicMmhg());
        v.setDiastolicMmhg(req.diastolicMmhg());
        v.setTemperatureC(req.temperatureC());
        v.setWeightKg(req.weightKg());
        v.setHeightCm(req.heightCm());
        v.setHeartRateBpm(req.heartRateBpm());
        v.setRespiratoryRateBpm(req.respiratoryRateBpm());
        v.setSpo2Percent(req.spo2Percent());
        v.setGlycemiaGPerL(req.glycemiaGPerL());
        v.setAbdominalPerimeterCm(req.abdominalPerimeterCm());
        v.setHeadCircumferenceCm(req.headCircumferenceCm());
        v.setNotes(req.notes());
        v.setBmi(computeBmi(req.weightKg(), req.heightCm()));
    }

    @Transactional(readOnly = true)
    public List<VitalSigns> forPatient(UUID patientId) {
        return vitalsRepository.findByPatientIdOrderByRecordedAtDesc(patientId);
    }

    /**
     * Enregistre des constantes rattachées à un séjour hospitalier (soins au lit,
     * V056). Le {@code patientId} est résolu par l'appelant (module hospitalisation)
     * depuis le séjour. Pas de transition de statut RDV (séjour ≠ file d'attente).
     */
    public VitalSigns recordForStay(UUID stayId, UUID patientId, UUID recordedBy, RecordVitalsRequest req) {
        VitalSigns v = new VitalSigns();
        v.setPatientId(patientId);
        v.setStayId(stayId);
        applyVitals(v, req);
        v.setRecordedBy(recordedBy);
        return vitalsRepository.save(v);
    }

    @Transactional(readOnly = true)
    public List<VitalSigns> forStay(UUID stayId) {
        return vitalsRepository.findByStayIdOrderByRecordedAtDesc(stayId);
    }

    private static BigDecimal computeBmi(BigDecimal weightKg, BigDecimal heightCm) {
        if (weightKg == null || heightCm == null || heightCm.signum() <= 0) return null;
        BigDecimal heightM = heightCm.movePointLeft(2); // cm → m
        BigDecimal heightMSquared = heightM.multiply(heightM);
        return weightKg.divide(heightMSquared, 2, RoundingMode.HALF_UP);
    }

    @SuppressWarnings("unused")
    private static Optional<VitalSigns> emptyPlaceholder() {
        return Optional.empty();
    }
}
