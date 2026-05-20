package ma.careplus.identity.infrastructure.persistence;

import java.util.List;
import java.util.UUID;
import ma.careplus.identity.domain.ReferralContact;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReferralContactRepository extends JpaRepository<ReferralContact, UUID> {

    /**
     * Carnet d'un médecin, trié par spécialité puis nom — l'UI le rend tel
     * quel (regroupé visuellement par spécialité, sans tri client).
     */
    List<ReferralContact> findByOwnerIdOrderBySpecialtyAscFullNameAsc(UUID ownerId);
}
