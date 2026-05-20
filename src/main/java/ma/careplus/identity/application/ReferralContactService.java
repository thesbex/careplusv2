package ma.careplus.identity.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.identity.domain.ReferralContact;
import ma.careplus.identity.infrastructure.persistence.ReferralContactRepository;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * CRUD du carnet personnel de confrères (V046). Toutes les opérations sont
 * scopées au médecin propriétaire (ownerId) — le caller ne peut ni lire ni
 * éditer un contact d'un autre médecin. Le contrôleur passe systématiquement
 * l'id du user authentifié comme ownerId ; le service ne fait jamais
 * confiance à l'ownerId envoyé côté client.
 */
@Service
@Transactional
public class ReferralContactService {

    private final ReferralContactRepository repository;

    public ReferralContactService(ReferralContactRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<ReferralContact> listFor(UUID ownerId) {
        return repository.findByOwnerIdOrderBySpecialtyAscFullNameAsc(ownerId);
    }

    public ReferralContact create(UUID ownerId, String fullName, String specialty,
                                  String phone, String city, String notes) {
        validate(fullName, specialty);
        ReferralContact c = new ReferralContact();
        c.setOwnerId(ownerId);
        c.setFullName(fullName.trim());
        c.setSpecialty(specialty.trim());
        c.setPhone(blankToNull(phone));
        c.setCity(blankToNull(city));
        c.setNotes(blankToNull(notes));
        return repository.save(c);
    }

    public ReferralContact update(UUID ownerId, UUID id, String fullName, String specialty,
                                  String phone, String city, String notes) {
        validate(fullName, specialty);
        ReferralContact c = mustOwn(ownerId, id);
        c.setFullName(fullName.trim());
        c.setSpecialty(specialty.trim());
        c.setPhone(blankToNull(phone));
        c.setCity(blankToNull(city));
        c.setNotes(blankToNull(notes));
        return repository.save(c);
    }

    public void delete(UUID ownerId, UUID id) {
        ReferralContact c = mustOwn(ownerId, id);
        repository.delete(c);
    }

    /** Refuse l'accès à un contact d'un autre médecin via 404 plutôt que 403
     *  pour ne pas confirmer l'existence à un caller non autorisé. */
    private ReferralContact mustOwn(UUID ownerId, UUID id) {
        ReferralContact c = repository.findById(id)
                .orElseThrow(() -> new BusinessException("REFERRAL_NOT_FOUND",
                        "Confrère introuvable.", HttpStatus.NOT_FOUND.value()));
        if (!c.getOwnerId().equals(ownerId)) {
            throw new BusinessException("REFERRAL_NOT_FOUND",
                    "Confrère introuvable.", HttpStatus.NOT_FOUND.value());
        }
        return c;
    }

    private static void validate(String fullName, String specialty) {
        if (fullName == null || fullName.trim().isEmpty()) {
            throw new BusinessException("REFERRAL_FULL_NAME_REQUIRED",
                    "Le nom complet est requis.", HttpStatus.BAD_REQUEST.value());
        }
        if (specialty == null || specialty.trim().isEmpty()) {
            throw new BusinessException("REFERRAL_SPECIALTY_REQUIRED",
                    "La spécialité est requise.", HttpStatus.BAD_REQUEST.value());
        }
    }

    private static String blankToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
