package ma.careplus.identity.infrastructure.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Rate limits POST /api/auth/login to 5 attempts per 15 minutes per IP.
 * Uses Bucket4j in-memory (no Redis required in on-premise single instance).
 */
@Component
public class LoginRateLimitFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(LoginRateLimitFilter.class);

    private static final String LOGIN_PATH = "/api/auth/login";
    private static final int CAPACITY = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (!("POST".equalsIgnoreCase(request.getMethod()) &&
                LOGIN_PATH.equals(request.getRequestURI()))) {
            filterChain.doFilter(request, response);
            return;
        }

        String ip = extractIp(request);
        Bucket bucket = buckets.computeIfAbsent(ip, this::newBucket);

        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            log.warn("Rate limit exceeded for IP {} on {}", ip, LOGIN_PATH);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
            response.getWriter().write(
                    "{\"status\":429,\"title\":\"RATE_LIMIT\",\"detail\":\"Trop de tentatives. Réessayez dans 15 minutes.\"}");
        }
    }

    private Bucket newBucket(String ip) {
        Bandwidth limit = Bandwidth.builder()
                .capacity(CAPACITY)
                .refillIntervally(CAPACITY, WINDOW)
                .build();
        return Bucket.builder().addLimit(limit).build();
    }

    private String extractIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            return xff.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    /**
     * Test-only seam: drops every IP bucket so each integration-test method
     * starts with a full quota. Never call from production code — the 15-min
     * refill handles everything there.
     */
    public void clearBucketsForTests() {
        buckets.clear();
    }
}
