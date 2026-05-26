package ma.careplus.finance.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import ma.careplus.finance.application.ExpenseService;
import ma.careplus.finance.domain.Expense;
import ma.careplus.finance.domain.ExpenseCategory;
import ma.careplus.finance.infrastructure.web.dto.ExpenseRequest;
import ma.careplus.finance.infrastructure.web.dto.ExpenseResponse;
import ma.careplus.finance.infrastructure.web.dto.MonthlyTotalResponse;
import ma.careplus.finance.infrastructure.web.mapper.ExpenseMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cabinet expense endpoints (QA9-15).
 *
 * <pre>
 *   GET    /api/expenses                    MEDECIN + ADMIN
 *   POST   /api/expenses                    ADMIN only
 *   PUT    /api/expenses/{id}               ADMIN only
 *   DELETE /api/expenses/{id}               ADMIN only (soft delete)
 *   GET    /api/expenses/summary?year=YYYY  MEDECIN + ADMIN
 * </pre>
 */
@RestController
@RequestMapping("/api/expenses")
@Tag(name = "finance", description = "Cabinet expense tracking (QA9-15)")
public class ExpenseController {

    private final ExpenseService  expenseService;
    private final ExpenseMapper   expenseMapper;

    public ExpenseController(ExpenseService expenseService, ExpenseMapper expenseMapper) {
        this.expenseService = expenseService;
        this.expenseMapper  = expenseMapper;
    }

    // ── GET /api/expenses ─────────────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<List<ExpenseResponse>> list(
            @RequestParam(required = false) String    category,
            @RequestParam(required = false) LocalDate from,
            @RequestParam(required = false) LocalDate to) {

        ExpenseCategory cat = null;
        if (category != null && !category.isBlank()) {
            cat = ExpenseCategory.valueOf(category); // 400 IllegalArgumentException if invalid
        }
        List<ExpenseResponse> body = expenseService.list(cat, from, to)
                .stream()
                .map(expenseMapper::toResponse)
                .toList();
        return ResponseEntity.ok(body);
    }

    // ── POST /api/expenses ────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ExpenseResponse> create(
            @Valid @RequestBody ExpenseRequest req,
            Authentication auth) {

        UUID actorId = resolveUserId(auth);
        Expense saved = expenseService.create(req, actorId);
        return ResponseEntity
                .created(URI.create("/api/expenses/" + saved.getId()))
                .body(expenseMapper.toResponse(saved));
    }

    // ── PUT /api/expenses/{id} ────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ExpenseResponse> update(
            @PathVariable UUID id,
            @Valid @RequestBody ExpenseRequest req) {

        Expense updated = expenseService.update(id, req);
        return ResponseEntity.ok(expenseMapper.toResponse(updated));
    }

    // ── DELETE /api/expenses/{id} ─────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        expenseService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── GET /api/expenses/summary ─────────────────────────────────────────────

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<List<MonthlyTotalResponse>> summary(
            @RequestParam int year) {

        return ResponseEntity.ok(expenseService.monthlySummary(year));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UUID resolveUserId(Authentication auth) {
        if (auth == null) return null;
        try { return UUID.fromString(auth.getName()); }
        catch (IllegalArgumentException ignored) { return null; }
    }
}
