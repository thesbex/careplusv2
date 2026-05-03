package ma.careplus.shared.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Forwards browser navigations to non-API paths to the SPA's index.html so
 * React Router can take over (ADR-020: single jar serves API + SPA).
 *
 * Without this, hitting https://<host>/agenda directly (hard refresh, shared
 * link, email click) would 404 because Spring only has /api/* and /actuator/*
 * controllers mapped. With this, any GET that:
 *   - isn't /api/**
 *   - isn't /actuator/**
 *   - doesn't look like a static file (has no "." in the last segment)
 * → forwards to /index.html, which loads the SPA, which hands the URL to
 * React Router to render the right screen.
 */
@Controller
public class SpaFallbackController {

    @GetMapping(value = {
            "/{path:^(?!api$|actuator$|swagger-ui$|v3$|assets$|static$)[^.]+}",
            "/{path:^(?!api$|actuator$|swagger-ui$|v3$|assets$|static$)[^.]+}/**",
    })
    public String forwardToIndex(HttpServletRequest request) {
        return "forward:/index.html";
    }
}
