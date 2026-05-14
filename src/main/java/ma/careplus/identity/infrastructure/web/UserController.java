package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Set;
import ma.careplus.identity.application.RolePermissionResolver;
import ma.careplus.identity.application.UserService;
import ma.careplus.identity.domain.User;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import ma.careplus.identity.infrastructure.web.mapper.UserMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@Tag(name = "identity", description = "User endpoints")
public class UserController {

    private final UserService userService;
    private final UserMapper userMapper;
    private final RolePermissionResolver rolePermissionResolver;

    public UserController(UserService userService,
                          UserMapper userMapper,
                          RolePermissionResolver rolePermissionResolver) {
        this.userService = userService;
        this.userMapper = userMapper;
        this.rolePermissionResolver = rolePermissionResolver;
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
                base.specialty(), base.inpe(), base.cnom(), base.cnops()));
    }
}
