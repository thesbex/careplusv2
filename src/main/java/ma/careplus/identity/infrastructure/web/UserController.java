package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import ma.careplus.identity.application.UserService;
import ma.careplus.identity.domain.User;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import ma.careplus.identity.infrastructure.web.mapper.UserMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbc;

    public UserController(UserService userService, UserMapper userMapper, JdbcTemplate jdbc) {
        this.userService = userService;
        this.userMapper = userMapper;
        this.jdbc = jdbc;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user profile")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserView> me(Authentication authentication) {
        User user = userService.getCurrentUser(authentication);
        UserView base = userMapper.toView(user);
        Set<String> perms = base.roles().isEmpty()
                ? Collections.emptySet()
                : permissionsForRoles(base.roles());
        return ResponseEntity.ok(new UserView(
                base.id(), base.email(), base.firstName(), base.lastName(), base.roles(), perms));
    }

    /**
     * Union of permissions across the user's roles, restricted to entries
     * flagged granted=TRUE in identity_role_permission.
     */
    private Set<String> permissionsForRoles(Set<String> roles) {
        if (roles.isEmpty()) return Collections.emptySet();
        String placeholders = String.join(",", Collections.nCopies(roles.size(), "?"));
        List<String> codes = jdbc.queryForList(
                "SELECT DISTINCT permission FROM identity_role_permission "
                        + "WHERE granted = TRUE AND role_code IN (" + placeholders + ")",
                String.class,
                roles.toArray());
        return new LinkedHashSet<>(codes);
    }
}
