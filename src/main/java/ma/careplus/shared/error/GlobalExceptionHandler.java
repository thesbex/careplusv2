package ma.careplus.shared.error;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import ma.careplus.identity.application.AccountLockedException;
import ma.careplus.identity.application.InvalidCredentialsException;
import ma.careplus.identity.application.InvalidTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

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
