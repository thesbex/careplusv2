package ma.careplus.identity.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import ma.careplus.identity.domain.User;
import ma.careplus.identity.infrastructure.persistence.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_MINUTES = 15;

    private final UserRepository userRepository;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final PasswordEncoder passwordEncoder;

    public AuthService(UserRepository userRepository,
                       JwtService jwtService,
                       RefreshTokenService refreshTokenService,
                       PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(
            noRollbackFor = { InvalidCredentialsException.class, AccountLockedException.class })
    public LoginResult login(String email, String password, String userAgent, String ip) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(InvalidCredentialsException::new);

        if (!user.isEnabled()) {
            throw new InvalidCredentialsException();
        }

        if (user.isLocked()) {
            throw new AccountLockedException("Compte verrouillé. Réessayez dans quelques minutes.");
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            userRepository.incrementFailedAttempts(user.getId());
            int newCount = user.getFailedAttempts() + 1;
            if (newCount >= MAX_FAILED_ATTEMPTS) {
                User reloaded = userRepository.findById(user.getId()).orElseThrow();
                reloaded.setLockedUntil(OffsetDateTime.now().plusMinutes(LOCK_MINUTES));
                userRepository.save(reloaded);
                log.warn("User {} locked after {} failed attempts", email, newCount);
            }
            throw new InvalidCredentialsException();
        }

        // Successful login — reset failed attempts and update last login
        userRepository.resetFailedAttempts(user.getId());
        user.setLastLoginAt(OffsetDateTime.now());
        userRepository.save(user);

        List<String> roleList = user.getRoles().stream().map(r -> r.getCode()).toList();
        Set<String> rolesSet = user.getRoles().stream().map(r -> r.getCode()).collect(Collectors.toSet());

        String accessToken = jwtService.issue(user.getId(), roleList);
        String rawRefreshToken = refreshTokenService.createToken(user.getId(), userAgent, ip);

        return new LoginResult(
                accessToken,
                rawRefreshToken,
                jwtService.accessTtlSeconds(),
                user.getId(),
                user.getEmail(),
                user.getFirstName(),
                user.getLastName(),
                rolesSet
        );
    }

    @Transactional
    public RefreshResult refresh(String rawRefreshToken, String userAgent, String ip) {
        RotateResult rotated = refreshTokenService.rotateToken(rawRefreshToken, userAgent, ip);

        User user = userRepository.findById(rotated.token().getUserId())
                .orElseThrow(() -> new InvalidTokenException("User not found for refresh token"));

        if (!user.isEnabled() || user.isLocked()) {
            throw new InvalidTokenException("Account disabled or locked");
        }

        List<String> roleList = user.getRoles().stream().map(r -> r.getCode()).toList();
        String accessToken = jwtService.issue(user.getId(), roleList);

        return new RefreshResult(accessToken, rotated.rawToken(), jwtService.accessTtlSeconds());
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokenService.revokeToken(rawRefreshToken);
    }
}
