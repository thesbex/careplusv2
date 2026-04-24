package ma.careplus.identity.application;

import java.util.UUID;
import ma.careplus.identity.domain.User;
import ma.careplus.identity.infrastructure.persistence.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public User getCurrentUser(Authentication authentication) {
        UUID userId = UUID.fromString(authentication.getName());
        return userRepository.findById(userId)
                .orElseThrow(() -> new ma.careplus.shared.error.NotFoundException(
                        "IDN-001", "Utilisateur introuvable"));
    }
}
