package ma.careplus.shared.error;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import ma.careplus.catalog.application.AllergyConflictException;
import ma.careplus.identity.application.AccountLockedException;
import ma.careplus.identity.application.InvalidCredentialsException;
import ma.careplus.identity.application.InvalidTokenException;
import org.springframework.security.access.AccessDeniedException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Global error handler. Produces RFC 7807 application/problem+json.
 * Business errors keep their stable error code (PAT-001, etc.).
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ProblemDetail> handleBusiness(BusinessException ex, HttpServletRequest req) {
        HttpStatus status = HttpStatus.resolve(ex.getStatus()) != null
                ? HttpStatus.valueOf(ex.getStatus()) : HttpStatus.UNPROCESSABLE_ENTITY;
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, ex.getMessage());
        pd.setType(URI.create("https://careplus.ma/errors/" + ex.getCode()));
        pd.setTitle(ex.getCode());
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", ex.getCode());
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        List<Map<String, String>> fields = ex.getBindingResult().getFieldErrors().stream()
                .map(f -> Map.of("field", f.getField(), "message", f.getDefaultMessage() == null ? "" : f.getDefaultMessage()))
                .toList();
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Validation failed");
        pd.setType(URI.create("https://careplus.ma/errors/VALIDATION"));
        pd.setTitle("VALIDATION");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "VALIDATION");
        pd.setProperty("fields", fields);
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ProblemDetail> handleInvalidCredentials(InvalidCredentialsException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
        pd.setType(URI.create("https://careplus.ma/errors/IDN-001"));
        pd.setTitle("IDN-001");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "IDN-001");
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(AccountLockedException.class)
    public ResponseEntity<ProblemDetail> handleAccountLocked(AccountLockedException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
        pd.setType(URI.create("https://careplus.ma/errors/IDN-002"));
        pd.setTitle("IDN-002");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "IDN-002");
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(InvalidTokenException.class)
    public ResponseEntity<ProblemDetail> handleInvalidToken(InvalidTokenException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED, ex.getMessage());
        pd.setType(URI.create("https://careplus.ma/errors/IDN-003"));
        pd.setTitle("IDN-003");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "IDN-003");
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(AllergyConflictException.class)
    public ResponseEntity<Map<String, Object>> handleAllergyConflict(AllergyConflictException ex, HttpServletRequest req) {
        Map<String, Object> body = new java.util.LinkedHashMap<>();
        body.put("type", "allergy-conflict");
        body.put("title", "Conflit allergique");
        body.put("medication", ex.getMedication());
        body.put("allergy", ex.getAllergy());
        body.put("status", 422);
        body.put("timestamp", OffsetDateTime.now());
        body.put("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(422).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(body);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ProblemDetail> handleAccessDenied(AccessDeniedException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, "Accès refusé.");
        pd.setType(URI.create("https://careplus.ma/errors/FORBIDDEN"));
        pd.setTitle("FORBIDDEN");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "FORBIDDEN");
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(HttpStatus.FORBIDDEN).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    /**
     * Spring 6.1+ : un chemin inconnu déclenche NoResourceFoundException
     * (au lieu d'un 404 implicite). Sans handler dédié, il tombait dans
     * le catch-all et renvoyait 500 — toute URL fautive devenait une
     * fausse alerte serveur (audit 2026-05-01).
     */
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetail> handleNoResource(NoResourceFoundException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, "Route inconnue : " + req.getRequestURI());
        pd.setType(URI.create("https://careplus.ma/errors/ROUTE_NOT_FOUND"));
        pd.setTitle("ROUTE_NOT_FOUND");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "ROUTE_NOT_FOUND");
        pd.setProperty("method", req.getMethod());
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(HttpStatus.NOT_FOUND).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    /**
     * Paramètre `@RequestParam` obligatoire absent : c'est une erreur
     * client (mauvaise URL), pas serveur. Doit retourner 400, pas 500.
     */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ProblemDetail> handleMissingParam(MissingServletRequestParameterException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Paramètre obligatoire manquant : " + ex.getParameterName());
        pd.setType(URI.create("https://careplus.ma/errors/PARAM_MISSING"));
        pd.setTitle("PARAM_MISSING");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "PARAM_MISSING");
        pd.setProperty("parameter", ex.getParameterName());
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    /**
     * Paramètre `@RequestParam` au mauvais format (ex. UUID invalide) :
     * 400, pas 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ProblemDetail> handleTypeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest req) {
        String required = ex.getRequiredType() != null ? ex.getRequiredType().getSimpleName() : "(?)";
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Paramètre `" + ex.getName() + "` invalide (attendu : " + required + ").");
        pd.setType(URI.create("https://careplus.ma/errors/PARAM_INVALID"));
        pd.setTitle("PARAM_INVALID");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "PARAM_INVALID");
        pd.setProperty("parameter", ex.getName());
        pd.setProperty("expectedType", required);
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.badRequest().contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    /**
     * Verbe HTTP non supporté sur cette route : 405 Method Not Allowed.
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ProblemDetail> handleMethodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest req) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.METHOD_NOT_ALLOWED,
                "Méthode " + ex.getMethod() + " non supportée pour cette route.");
        pd.setType(URI.create("https://careplus.ma/errors/METHOD_NOT_ALLOWED"));
        pd.setTitle("METHOD_NOT_ALLOWED");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "METHOD_NOT_ALLOWED");
        pd.setProperty("method", ex.getMethod());
        pd.setProperty("supported", ex.getSupportedMethods());
        pd.setProperty("timestamp", OffsetDateTime.now());
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED).contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetail> handleGeneric(Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception for {} {}", req.getMethod(), req.getRequestURI(), ex);
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error");
        pd.setType(URI.create("https://careplus.ma/errors/INTERNAL"));
        pd.setTitle("INTERNAL");
        pd.setInstance(URI.create(req.getRequestURI()));
        pd.setProperty("code", "INTERNAL");
        pd.setProperty("correlationId", MDC.get("correlationId"));
        return ResponseEntity.internalServerError().contentType(MediaType.APPLICATION_PROBLEM_JSON).body(pd);
    }
}
