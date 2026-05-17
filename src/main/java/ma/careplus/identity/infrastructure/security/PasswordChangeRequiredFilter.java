package ma.careplus.identity.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * V044 — Blocks every authenticated request from a user whose
 * {@code password_change_required} flag is TRUE, except the small whitelist
 * needed to actually pick a new password and to log out.
 *
 * <p>Runs after {@link JwtAuthenticationFilter} (so the authentication is
 * already in the security context). Issues an RFC 7807 problem+json 403 with
 * the {@code PASSWORD_CHANGE_REQUIRED} code so the SPA can intercept it and
 * redirect to {@code /force-change-password} without parsing free-form
 * messages.
 */
@Component
public class PasswordChangeRequiredFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(PasswordChangeRequiredFilter.class);

    /** Endpoints the user is allowed to hit while the flag is still TRUE. */
    private static final Set<String> WHITELIST = Set.of(
            "/api/users/me",
            "/api/users/me/change-password",
            "/api/auth/logout",
            "/api/auth/refresh");

    private final JdbcTemplate jdbc;

    public PasswordChangeRequiredFilter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            // Anonymous request — JWT filter didn't authenticate. Let downstream
            // entry point handle it (probably 401 or public route).
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();
        if (!path.startsWith("/api/") || isWhitelisted(path)) {
            filterChain.doFilter(request, response);
            return;
        }

        UUID userId;
        try {
            userId = UUID.fromString(auth.getName());
        } catch (IllegalArgumentException e) {
            // Subject isn't a UUID — leave the request alone. The downstream
            // security pipeline will sort it out.
            filterChain.doFilter(request, response);
            return;
        }

        Boolean flag = jdbc.queryForObject(
                "SELECT password_change_required FROM identity_user WHERE id = ?",
                Boolean.class, userId);
        if (Boolean.TRUE.equals(flag)) {
            log.debug("User {} blocked from {} (password_change_required)", userId, path);
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.getWriter().write(
                    "{\"status\":403,\"title\":\"PASSWORD_CHANGE_REQUIRED\","
                            + "\"code\":\"PASSWORD_CHANGE_REQUIRED\","
                            + "\"detail\":\"Vous devez changer votre mot de passe avant de continuer.\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static boolean isWhitelisted(String path) {
        return WHITELIST.contains(path);
    }
}
