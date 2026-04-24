package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import ma.careplus.identity.application.AuthService;
import ma.careplus.identity.application.LoginResult;
import ma.careplus.identity.application.RefreshResult;
import ma.careplus.identity.infrastructure.web.dto.LoginRequest;
import ma.careplus.identity.infrastructure.web.dto.LoginResponse;
import ma.careplus.identity.infrastructure.web.dto.RefreshResponse;
import ma.careplus.identity.infrastructure.web.dto.UserView;
import ma.careplus.identity.infrastructure.web.mapper.UserMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "identity", description = "Authentication endpoints")
public class AuthController {

    private static final String REFRESH_COOKIE = "careplus_refresh";

    private final AuthService authService;
    private final UserMapper userMapper;
    private final ma.careplus.identity.application.RefreshTokenService refreshTokenService;

    public AuthController(AuthService authService,
                          UserMapper userMapper,
                          ma.careplus.identity.application.RefreshTokenService refreshTokenService) {
        this.authService = authService;
        this.userMapper = userMapper;
        this.refreshTokenService = refreshTokenService;
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email + password")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest req,
                                               HttpServletRequest httpReq,
                                               HttpServletResponse httpResp) {
        String userAgent = httpReq.getHeader("User-Agent");
        String ip = extractIp(httpReq);

        LoginResult result = authService.login(req.email(), req.password(), userAgent, ip);

        setRefreshCookie(httpResp, result.rawRefreshToken(), (int) refreshTokenService.refreshTtlSeconds());

        UserView userView = userMapper.fromLoginResult(result);
        LoginResponse response = new LoginResponse(result.accessToken(), result.expiresInSeconds(), userView);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate refresh token, issue new access token")
    public ResponseEntity<RefreshResponse> refresh(HttpServletRequest httpReq,
                                                   HttpServletResponse httpResp) {
        String rawToken = extractRefreshCookie(httpReq);
        if (rawToken == null) {
            return ResponseEntity.status(401).build();
        }

        String userAgent = httpReq.getHeader("User-Agent");
        String ip = extractIp(httpReq);

        RefreshResult result = authService.refresh(rawToken, userAgent, ip);

        setRefreshCookie(httpResp, result.rawRefreshToken(), (int) refreshTokenService.refreshTtlSeconds());

        return ResponseEntity.ok(new RefreshResponse(result.accessToken(), result.expiresInSeconds()));
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke refresh token and clear cookie")
    public ResponseEntity<Void> logout(HttpServletRequest httpReq, HttpServletResponse httpResp) {
        String rawToken = extractRefreshCookie(httpReq);
        if (rawToken != null) {
            authService.logout(rawToken);
        }
        clearRefreshCookie(httpResp);
        return ResponseEntity.noContent().build();
    }

    // --- cookie helpers ---

    private void setRefreshCookie(HttpServletResponse response, String rawToken, int maxAgeSeconds) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, rawToken);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(maxAgeSeconds);
        // SameSite=Strict — set via header because Jakarta Cookie API doesn't expose SameSite
        response.addCookie(cookie);
        // Override with explicit SameSite=Strict header
        String headerValue = REFRESH_COOKIE + "=" + rawToken
                + "; Path=/api/auth"
                + "; Max-Age=" + maxAgeSeconds
                + "; HttpOnly"
                + "; Secure"
                + "; SameSite=Strict";
        response.setHeader("Set-Cookie", headerValue);
    }

    private void clearRefreshCookie(HttpServletResponse response) {
        Cookie cookie = new Cookie(REFRESH_COOKIE, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/api/auth");
        cookie.setMaxAge(0);
        response.addCookie(cookie);
        String headerValue = REFRESH_COOKIE + "="
                + "; Path=/api/auth"
                + "; Max-Age=0"
                + "; HttpOnly"
                + "; Secure"
                + "; SameSite=Strict";
        response.setHeader("Set-Cookie", headerValue);
    }

    private String extractRefreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie c : request.getCookies()) {
            if (REFRESH_COOKIE.equals(c.getName())) return c.getValue();
        }
        return null;
    }

    private String extractIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return request.getRemoteAddr();
    }
}
