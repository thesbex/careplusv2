package ma.careplus.shared.config;

import jakarta.servlet.http.HttpServletResponse;
import java.util.Arrays;
import java.util.List;
import ma.careplus.identity.infrastructure.security.JwtAuthenticationFilter;
import ma.careplus.identity.infrastructure.security.LoginRateLimitFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Security configuration. JWT stateless. Rate-limit on login.
 * Public: /actuator/health, /api/auth/*, OpenAPI, Swagger.
 * Everything else under /api/** requires authentication.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final LoginRateLimitFilter loginRateLimitFilter;

    /**
     * Comma-separated list of allowed origins for CORS preflight + actual requests.
     * Empty = no cross-origin requests permitted (same-origin only — the production
     * deployment serves the SPA from the same Spring Boot process).
     */
    @Value("${careplus.security.cors.allowed-origins:}")
    private String allowedOriginsCsv;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter,
                          LoginRateLimitFilter loginRateLimitFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.loginRateLimitFilter = loginRateLimitFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        List<String> origins = allowedOriginsCsv == null || allowedOriginsCsv.isBlank()
                ? List.of()
                : Arrays.stream(allowedOriginsCsv.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
        cfg.setAllowedOrigins(origins);
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Correlation-Id"));
        cfg.setExposedHeaders(List.of("Location", "X-Correlation-Id"));
        cfg.setAllowCredentials(!origins.isEmpty());
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", cfg);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // API + actuator — public endpoints
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/info",
                                "/v3/api-docs/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/api/auth/login",
                                "/api/auth/refresh",
                                "/api/auth/logout",
                                "/api/admin/bootstrap",
                                "/error")
                            .permitAll()
                        // SPA — serve the React bundle + its assets anonymously.
                        // Client-side <RequireAuth> gates protected routes; real
                        // data still requires a JWT on /api/**.
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/favicon.ico",
                                "/assets/**",
                                "/static/**")
                            .permitAll()
                        // API + actuator — every other /api/** and /actuator/** is authenticated
                        .requestMatchers("/api/**", "/actuator/**")
                            .authenticated()
                        // Anything else = SPA deep-link (e.g. /agenda, /dossier/:id).
                        // SpaFallbackController forwards these to index.html; permit so
                        // Spring Security doesn't 401 them before the forward happens.
                        .anyRequest().permitAll())
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(problemJsonAuthEntryPoint())
                        .accessDeniedHandler(problemJsonAccessDeniedHandler()))
                .addFilterBefore(loginRateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                .httpBasic(basic -> basic.disable())
                .build();
    }

    /**
     * 401 for anonymous requests hitting protected endpoints — Spring's default is 403
     * which conflates "not logged in" with "logged in but forbidden". Issues distinct
     * problem+json responses per RFC 7807, matching GlobalExceptionHandler's shape.
     */
    @Bean
    public AuthenticationEntryPoint problemJsonAuthEntryPoint() {
        return (request, response, ex) -> {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.getWriter().write(
                    "{\"status\":401,\"title\":\"UNAUTHORIZED\",\"detail\":\"Authentification requise.\"}");
        };
    }

    @Bean
    public AccessDeniedHandler problemJsonAccessDeniedHandler() {
        return (request, response, ex) -> {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.getWriter().write(
                    "{\"status\":403,\"title\":\"FORBIDDEN\",\"detail\":\"Accès refusé.\"}");
        };
    }
}
