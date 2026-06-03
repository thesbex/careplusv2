package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.Set;
import java.util.UUID;
import ma.careplus.identity.application.RolePermissionResolver;
import ma.careplus.identity.application.UserService;
import ma.careplus.identity.domain.User;
import ma.careplus.identity.infrastructure.web.dto.ChangePasswordRequest;
import ma.careplus.identity.infrastructure.web.dto.MeAppearanceView;
import ma.careplus.identity.infrastructure.web.dto.UpdateMeAppearanceRequest;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import ma.careplus.identity.infrastructure.web.mapper.UserMapper;
import ma.careplus.shared.error.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@Tag(name = "identity", description = "User endpoints")
public class UserController {

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    private final UserService userService;
    private final UserMapper userMapper;
    private final RolePermissionResolver rolePermissionResolver;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;

    public UserController(UserService userService,
                          UserMapper userMapper,
                          RolePermissionResolver rolePermissionResolver,
                          PasswordEncoder passwordEncoder,
                          JdbcTemplate jdbc) {
        this.userService = userService;
        this.userMapper = userMapper;
        this.rolePermissionResolver = rolePermissionResolver;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserView> me(Authentication authentication) {
        User user = userService.getCurrentUser(authentication);
        UserView base = userMapper.toView(user);
        Set<String> perms = rolePermissionResolver.resolveForRoles(base.roles());
        // /me does not expose assignment edits — we leave assignedPractitionerIds
        // out of the response (the dedicated admin listing surfaces it instead).
        // V040 — preserve practitioner credentials so the onboarding wizard /
        // profil page can read them without a second round-trip via /api/admin.
        return ResponseEntity.ok(new UserView(
                base.id(), base.email(), base.firstName(), base.lastName(), base.roles(),
                perms, java.util.Collections.emptyList(),
                base.specialty(), base.inpe(), base.cnom(), base.cnops(),
                user.isPasswordChangeRequired()));
    }

    /**
     * V044 — Self-service password change.
     *
     * <p>The authenticated user provides their current password (proof of
     * possession) and a new one. On success we clear
     * {@code password_change_required} so users who were forced into the
     * change-password flow (after an admin reset) regain access to the rest
     * of the app. We keep the current session alive — no refresh token is
     * revoked — so the user stays logged in.
     */
    @PostMapping("/me/change-password")
    @Operation(summary = "Change own password")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<Void> changePassword(Authentication authentication,
                                                @Valid @RequestBody ChangePasswordRequest req) {
        User user = userService.getCurrentUser(authentication);

        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException(
                    "INVALID_CURRENT_PASSWORD",
                    "Le mot de passe actuel est incorrect.",
                    HttpStatus.BAD_REQUEST.value());
        }
        if (passwordEncoder.matches(req.newPassword(), user.getPasswordHash())) {
            throw new BusinessException(
                    "PASSWORD_REUSED",
                    "Le nouveau mot de passe doit être différent de l'actuel.",
                    HttpStatus.BAD_REQUEST.value());
        }

        UUID id = user.getId();
        String hash = passwordEncoder.encode(req.newPassword());
        jdbc.update(
                "UPDATE identity_user SET password_hash = ?, password_change_required = FALSE, "
                        + "updated_at = now() WHERE id = ?",
                hash, id);
        log.info("User {} changed their password", id);
        return ResponseEntity.noContent().build();
    }

    /**
     * V073 — Apparence personnelle de l'utilisateur courant.
     *
     * <p>Renvoie le JSON d'apparence perso, ou {@code null} si l'utilisateur suit
     * le défaut d'apparence du cabinet (V072). Le front résout :
     * override perso → défaut cabinet → défaut application.
     */
    @GetMapping("/me/appearance")
    @Operation(summary = "Get current user's personal appearance override")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<MeAppearanceView> myAppearance(Authentication authentication) {
        User user = userService.getCurrentUser(authentication);
        return ResponseEntity.ok(new MeAppearanceView(user.getAppearance()));
    }

    /**
     * V073 — Enregistre (ou réinitialise) l'apparence personnelle.
     *
     * <p>Disponible à TOUT utilisateur authentifié (chacun gère son propre
     * affichage, pas de garde super admin contrairement au défaut cabinet).
     * Un corps avec {@code appearance == null} efface l'override : l'utilisateur
     * retombe sur le défaut d'apparence du cabinet.
     */
    @PutMapping("/me/appearance")
    @Operation(summary = "Set or reset current user's personal appearance override")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<MeAppearanceView> updateMyAppearance(
            Authentication authentication,
            @Valid @RequestBody UpdateMeAppearanceRequest req) {
        User user = userService.getCurrentUser(authentication);
        String json = req.appearance();
        jdbc.update(
                "UPDATE identity_user SET appearance = ?, updated_at = now() WHERE id = ?",
                json, user.getId());
        log.info("User {} updated their personal appearance (reset={})", user.getId(), json == null);
        return ResponseEntity.ok(new MeAppearanceView(json));
    }
}
