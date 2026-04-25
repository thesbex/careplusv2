package ma.careplus.patient.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.identity.infrastructure.persistence.UserRepository;
import ma.careplus.patient.domain.Allergy;
import ma.careplus.patient.domain.AllergySeverity;
import ma.careplus.patient.domain.Antecedent;
import ma.careplus.patient.domain.AntecedentType;
import ma.careplus.patient.domain.Patient;
import ma.careplus.patient.domain.PatientNote;
import ma.careplus.patient.domain.PatientStatus;
import ma.careplus.patient.infrastructure.persistence.AllergyRepository;
import ma.careplus.patient.infrastructure.persistence.AntecedentRepository;
import ma.careplus.patient.infrastructure.persistence.PatientNoteRepository;
import ma.careplus.patient.infrastructure.persistence.PatientRepository;
import ma.careplus.patient.infrastructure.web.dto.CreateAllergyRequest;
import ma.careplus.patient.infrastructure.web.dto.CreateAntecedentRequest;
import ma.careplus.patient.infrastructure.web.dto.CreatePatientNoteRequest;
import ma.careplus.patient.infrastructure.web.dto.CreatePatientRequest;
import ma.careplus.patient.infrastructure.web.dto.PatientNoteResponse;
import ma.careplus.patient.infrastructure.web.dto.UpdatePatientRequest;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PatientService {

    private final PatientRepository patientRepository;
    private final AllergyRepository allergyRepository;
    private final AntecedentRepository antecedentRepository;
    private final PatientNoteRepository noteRepository;
    private final UserRepository userRepository;

    public PatientService(PatientRepository patientRepository,
                          AllergyRepository allergyRepository,
                          AntecedentRepository antecedentRepository,
                          PatientNoteRepository noteRepository,
                          UserRepository userRepository) {
        this.patientRepository = patientRepository;
        this.allergyRepository = allergyRepository;
        this.antecedentRepository = antecedentRepository;
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
    }

    // ── Patient CRUD ───────────────────────────────────────────────

    public Patient create(CreatePatientRequest req) {
        if (req.cin() != null && !req.cin().isBlank()
                && patientRepository.countByCinIgnoreCase(req.cin()) > 0) {
            throw new BusinessException(
                    "PATIENT_CIN_DUPLICATE",
                    "Un patient avec ce CIN existe déjà.",
                    HttpStatus.CONFLICT.value());
        }
        Patient p = new Patient();
        p.setFirstName(req.firstName());
        p.setLastName(req.lastName());
        p.setGender(req.gender());
        p.setBirthDate(req.birthDate());
        p.setCin(req.cin());
        p.setPhone(req.phone());
        p.setEmergencyPhone(req.emergencyPhone());
        p.setEmail(req.email());
        p.setAddress(req.address());
        p.setCity(req.city());
        p.setCountry(req.country() != null ? req.country() : "Maroc");
        p.setMaritalStatus(req.maritalStatus());
        p.setProfession(req.profession());
        p.setBloodGroup(req.bloodGroup());
        if (req.numberChildren() != null) p.setNumberChildren(req.numberChildren());
        p.setNotes(req.notes());
        if (req.tier() != null) p.setTier(req.tier());
        if (req.mutuelleInsuranceId() != null) p.setMutuelleInsuranceId(req.mutuelleInsuranceId());
        if (req.mutuellePolicyNumber() != null) p.setMutuellePoliceNumber(req.mutuellePolicyNumber());
        p.setStatus(PatientStatus.ACTIF);
        return patientRepository.save(p);
    }

    @Transactional(readOnly = true)
    public Patient getActive(UUID id) {
        return patientRepository.findActiveById(id)
                .orElseThrow(() -> new NotFoundException("PATIENT_NOT_FOUND", "Patient introuvable : " + id));
    }

    public Patient update(UUID id, UpdatePatientRequest req) {
        Patient p = getActive(id);

        if (req.cin() != null && !req.cin().equalsIgnoreCase(p.getCin())
                && patientRepository.countByCinIgnoreCase(req.cin()) > 0) {
            throw new BusinessException(
                    "PATIENT_CIN_DUPLICATE",
                    "Un patient avec ce CIN existe déjà.",
                    HttpStatus.CONFLICT.value());
        }

        if (req.firstName() != null)       p.setFirstName(req.firstName());
        if (req.lastName() != null)        p.setLastName(req.lastName());
        if (req.gender() != null)          p.setGender(req.gender());
        if (req.birthDate() != null)       p.setBirthDate(req.birthDate());
        if (req.cin() != null)             p.setCin(req.cin());
        if (req.phone() != null)           p.setPhone(req.phone());
        if (req.emergencyPhone() != null)  p.setEmergencyPhone(req.emergencyPhone());
        if (req.email() != null)           p.setEmail(req.email());
        if (req.address() != null)         p.setAddress(req.address());
        if (req.city() != null)            p.setCity(req.city());
        if (req.country() != null)         p.setCountry(req.country());
        if (req.maritalStatus() != null)   p.setMaritalStatus(req.maritalStatus());
        if (req.profession() != null)      p.setProfession(req.profession());
        if (req.bloodGroup() != null)      p.setBloodGroup(req.bloodGroup());
        if (req.numberChildren() != null)  p.setNumberChildren(req.numberChildren());
        if (req.notes() != null)           p.setNotes(req.notes());
        if (req.status() != null) {
            try {
                p.setStatus(PatientStatus.valueOf(req.status()));
            } catch (IllegalArgumentException ex) {
                throw new BusinessException(
                        "INVALID_STATUS",
                        "Statut inconnu : " + req.status(),
                        HttpStatus.BAD_REQUEST.value());
            }
        }
        return p;
    }

    public void softDelete(UUID id) {
        Patient p = getActive(id);
        p.setDeletedAt(OffsetDateTime.now());
        p.setStatus(PatientStatus.ARCHIVE);
    }

    @Transactional(readOnly = true)
    public Page<Patient> search(String q, Pageable pageable) {
        if (q == null || q.isBlank()) {
            return patientRepository.findAllActive(pageable);
        }
        return patientRepository.search(q.trim(), pageable);
    }

    // ── Allergies & antecedents (owned by Patient aggregate) ───────

    @Transactional(readOnly = true)
    public List<Allergy> getAllergies(UUID patientId) {
        getActive(patientId);
        return allergyRepository.findByPatientIdOrderByCreatedAtDesc(patientId);
    }

    public Allergy addAllergy(UUID patientId, CreateAllergyRequest req) {
        getActive(patientId);
        Allergy a = new Allergy();
        a.setPatientId(patientId);
        a.setSubstance(req.substance());
        a.setAtcTag(req.atcTag());
        if (req.severity() != null) a.setSeverity(AllergySeverity.valueOf(req.severity()));
        a.setNotes(req.notes());
        return allergyRepository.save(a);
    }

    @Transactional(readOnly = true)
    public List<Antecedent> getAntecedents(UUID patientId) {
        getActive(patientId);
        return antecedentRepository.findByPatientIdOrderByOccurredOnDescCreatedAtDesc(patientId);
    }

    public Antecedent addAntecedent(UUID patientId, CreateAntecedentRequest req) {
        getActive(patientId);
        Antecedent a = new Antecedent();
        a.setPatientId(patientId);
        a.setType(AntecedentType.valueOf(req.type()));
        a.setDescription(req.description());
        a.setOccurredOn(req.occurredOn());
        a.setCategory(req.category());
        return antecedentRepository.save(a);
    }

    // ── Patient notes ──────────────────────────────────────────────

    public PatientNoteResponse createNote(UUID patientId, CreatePatientNoteRequest req, UUID createdBy) {
        getActive(patientId);
        PatientNote note = new PatientNote();
        note.setPatientId(patientId);
        note.setContent(req.content());
        note.setCreatedBy(createdBy);
        PatientNote saved = noteRepository.save(note);
        return toNoteResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<PatientNoteResponse> getNotes(UUID patientId) {
        getActive(patientId);
        return noteRepository.findByPatientIdOrderByCreatedAtDesc(patientId)
                .stream()
                .map(this::toNoteResponse)
                .toList();
    }

    // ── Tier & mutuelle ────────────────────────────────────────────

    public Patient updateTier(UUID patientId, String tier, UUID actorId) {
        if (!"NORMAL".equals(tier) && !"PREMIUM".equals(tier)) {
            throw new BusinessException(
                    "INVALID_TIER",
                    "Tier invalide. Valeurs acceptées : NORMAL, PREMIUM.",
                    HttpStatus.BAD_REQUEST.value());
        }
        Patient p = getActive(patientId);
        p.setTier(tier);
        p.setUpdatedBy(actorId);
        return p;
    }

    public Patient updateMutuelle(UUID patientId, UUID insuranceId, String policyNumber, UUID actorId) {
        Patient p = getActive(patientId);
        p.setMutuelleInsuranceId(insuranceId);
        p.setMutuellePoliceNumber(policyNumber);
        p.setUpdatedBy(actorId);
        return p;
    }

    public void deleteAllergy(UUID patientId, UUID allergyId) {
        getActive(patientId);
        Allergy a = allergyRepository.findById(allergyId)
                .orElseThrow(() -> new NotFoundException("ALLERGY_NOT_FOUND", "Allergie introuvable."));
        if (!a.getPatientId().equals(patientId))
            throw new NotFoundException("ALLERGY_NOT_FOUND", "Allergie introuvable.");
        allergyRepository.delete(a);
    }

    public void deleteAntecedent(UUID patientId, UUID antecedentId) {
        getActive(patientId);
        Antecedent a = antecedentRepository.findById(antecedentId)
                .orElseThrow(() -> new NotFoundException("ANTECEDENT_NOT_FOUND", "Antécédent introuvable."));
        if (!a.getPatientId().equals(patientId))
            throw new NotFoundException("ANTECEDENT_NOT_FOUND", "Antécédent introuvable.");
        antecedentRepository.delete(a);
    }

    // ── Private helpers ────────────────────────────────────────────

    private PatientNoteResponse toNoteResponse(PatientNote note) {
        String name = userRepository.findById(note.getCreatedBy())
                .map(u -> u.getFirstName() + " " + u.getLastName())
                .orElse("Inconnu");
        return new PatientNoteResponse(
                note.getId(),
                note.getPatientId(),
                note.getContent(),
                name,
                note.getCreatedAt());
    }
}
