package ma.careplus.identity.application;

import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves the union of permissions granted by a user's roles.
 *
 * <p>Single source of truth shared by {@code UserController.me()} and
 * {@code AuthController.login()} — without it, login returned an empty
 * {@code permissions} set while {@code /users/me} returned the populated set,
 * and the SPA's {@code <RequirePermission>} guards bounced the user to /login
 * right after login (until the next page refresh re-hydrated from /me).
 */
@Component
public class RolePermissionResolver {

    private final JdbcTemplate jdbc;

    public RolePermissionResolver(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Set<String> resolveForRoles(Set<String> roles) {
        if (roles == null || roles.isEmpty()) return Collections.emptySet();
        String placeholders = String.join(",", Collections.nCopies(roles.size(), "?"));
        List<String> codes = jdbc.queryForList(
                "SELECT DISTINCT permission FROM identity_role_permission "
                        + "WHERE granted = TRUE AND role_code IN (" + placeholders + ")",
                String.class,
                roles.toArray());
        return new LinkedHashSet<>(codes);
    }
}
