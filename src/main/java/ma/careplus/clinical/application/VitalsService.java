package ma.careplus.clinical.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.clinical.domain.VitalSigns;
import ma.careplus.clinical.infrastructure.persistence.VitalSignsRepository;
import ma.careplus.clinical.infrastructure.web.dto.RecordVitalsRequest;
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

    public VitalsService(VitalSignsRepository vitalsRepository,
                         AppointmentRepository appointmentRepository) {
        this.vitalsRepository = vitalsRepository;
        this.appointmentRepository = appointmentRepository;
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
        v.setSystolicMmhg(req.systolicMmhg());
        v.setDiastolicMmhg(req.diastolicMmhg());
        v.setTemperatureC(req.temperatureC());
        v.setWeightKg(req.weightKg());
        v.setHeightCm(req.heightCm());
        v.setHeartRateBpm(req.heartRateBpm());
        v.setSpo2Percent(req.spo2Percent());
        v.setGlycemiaGPerL(req.glycemiaGPerL());
        v.setNotes(req.notes());
        v.setBmi(computeBmi(req.weightKg(), req.heightCm()));
        v.setRecordedBy(recordedBy);
        return vitalsRepository.save(v);
    }

    @Transactional(readOnly = true)
    public List<VitalSigns> forPatient(UUID patientId) {
        return vitalsRepository.findByPatientIdOrderByRecordedAtDesc(patientId);
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
