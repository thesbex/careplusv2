package ma.careplus.hr.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.hr.application.HrService;
import ma.careplus.hr.domain.StaffRole;
import ma.careplus.hr.infrastructure.web.dto.LeaveEntryRequest;
import ma.careplus.hr.infrastructure.web.dto.LeaveEntryResponse;
import ma.careplus.hr.infrastructure.web.dto.SalaryPaymentRequest;
import ma.careplus.hr.infrastructure.web.dto.SalaryPaymentResponse;
import ma.careplus.hr.infrastructure.web.dto.StaffRequest;
import ma.careplus.hr.infrastructure.web.dto.StaffResponse;
import ma.careplus.hr.infrastructure.web.dto.StaffSummaryResponse;
import ma.careplus.hr.infrastructure.web.mapper.HrMapper;
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
 * HR/Personnel management endpoints (QA9-14). All endpoints are ADMIN-only.
 *
 * <pre>
 *   GET    /api/hr/staff                      ADMIN — list staff (filters: active, role)
 *   POST   /api/hr/staff                      ADMIN — create staff
 *   GET    /api/hr/staff/{id}                 ADMIN — get staff detail
 *   PUT    /api/hr/staff/{id}                 ADMIN — update staff
 *   DELETE /api/hr/staff/{id}                 ADMIN — soft-delete staff
 *   GET    /api/hr/staff/{id}/summary         ADMIN — leave accrual summary
 *   GET    /api/hr/staff/{id}/leave           ADMIN — list leave entries
 *   POST   /api/hr/staff/{id}/leave           ADMIN — add leave entry
 *   DELETE /api/hr/leave/{id}                 ADMIN — delete leave entry
 *   GET    /api/hr/staff/{id}/payments        ADMIN — list salary payments
 *   POST   /api/hr/staff/{id}/payments        ADMIN — add salary payment
 *   DELETE /api/hr/payments/{id}              ADMIN — delete salary payment
 * </pre>
 */
@RestController
@RequestMapping("/api/hr")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "hr", description = "HR/Personnel management — ADMIN only (QA9-14)")
public class HrController {

    private final HrService hrService;
    private final HrMapper  hrMapper;

    public HrController(HrService hrService, HrMapper hrMapper) {
        this.hrService = hrService;
        this.hrMapper  = hrMapper;
    }

    // ── Staff CRUD ────────────────────────────────────────────────────────────

    @GetMapping("/staff")
    public ResponseEntity<List<StaffResponse>> listStaff(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String  role) {

        StaffRole staffRole = null;
        if (role != null && !role.isBlank()) {
            staffRole = StaffRole.valueOf(role);
        }
        List<StaffResponse> body = hrService.listStaff(active, staffRole)
                .stream()
                .map(hrMapper::toStaffResponse)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/staff")
    public ResponseEntity<StaffResponse> createStaff(
            @Valid @RequestBody StaffRequest req,
            Authentication auth) {

        UUID actorId = resolveUserId(auth);
        StaffResponse body = hrMapper.toStaffResponse(hrService.createStaff(req, actorId));
        return ResponseEntity
                .created(URI.create("/api/hr/staff/" + body.id()))
                .body(body);
    }

    @GetMapping("/staff/{id}")
    public ResponseEntity<StaffResponse> getStaff(@PathVariable UUID id) {
        return ResponseEntity.ok(hrMapper.toStaffResponse(hrService.findStaff(id)));
    }

    @PutMapping("/staff/{id}")
    public ResponseEntity<StaffResponse> updateStaff(
            @PathVariable UUID id,
            @Valid @RequestBody StaffRequest req) {

        return ResponseEntity.ok(hrMapper.toStaffResponse(hrService.updateStaff(id, req)));
    }

    @DeleteMapping("/staff/{id}")
    public ResponseEntity<Void> deleteStaff(@PathVariable UUID id) {
        hrService.deleteStaff(id);
        return ResponseEntity.noContent().build();
    }

    // ── Staff summary ─────────────────────────────────────────────────────────

    @GetMapping("/staff/{id}/summary")
    public ResponseEntity<StaffSummaryResponse> getSummary(@PathVariable UUID id) {
        return ResponseEntity.ok(hrService.getSummary(id));
    }

    // ── Leave entries ─────────────────────────────────────────────────────────

    @GetMapping("/staff/{id}/leave")
    public ResponseEntity<List<LeaveEntryResponse>> listLeave(@PathVariable UUID id) {
        List<LeaveEntryResponse> body = hrService.listLeave(id)
                .stream()
                .map(hrMapper::toLeaveEntryResponse)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/staff/{id}/leave")
    public ResponseEntity<LeaveEntryResponse> addLeave(
            @PathVariable UUID id,
            @Valid @RequestBody LeaveEntryRequest req,
            Authentication auth) {

        UUID actorId = resolveUserId(auth);
        LeaveEntryResponse body = hrMapper.toLeaveEntryResponse(hrService.addLeave(id, req, actorId));
        return ResponseEntity
                .created(URI.create("/api/hr/staff/" + id + "/leave/" + body.id()))
                .body(body);
    }

    @DeleteMapping("/leave/{id}")
    public ResponseEntity<Void> deleteLeave(@PathVariable UUID id) {
        hrService.deleteLeave(id);
        return ResponseEntity.noContent().build();
    }

    // ── Salary payments ───────────────────────────────────────────────────────

    @GetMapping("/staff/{id}/payments")
    public ResponseEntity<List<SalaryPaymentResponse>> listPayments(@PathVariable UUID id) {
        List<SalaryPaymentResponse> body = hrService.listPayments(id)
                .stream()
                .map(hrMapper::toSalaryPaymentResponse)
                .toList();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/staff/{id}/payments")
    public ResponseEntity<SalaryPaymentResponse> addPayment(
            @PathVariable UUID id,
            @Valid @RequestBody SalaryPaymentRequest req,
            Authentication auth) {

        UUID actorId = resolveUserId(auth);
        SalaryPaymentResponse body = hrMapper.toSalaryPaymentResponse(hrService.addPayment(id, req, actorId));
        return ResponseEntity
                .created(URI.create("/api/hr/staff/" + id + "/payments/" + body.id()))
                .body(body);
    }

    @DeleteMapping("/payments/{id}")
    public ResponseEntity<Void> deletePayment(@PathVariable UUID id) {
        hrService.deletePayment(id);
        return ResponseEntity.noContent().build();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private UUID resolveUserId(Authentication auth) {
        if (auth == null) return null;
        try { return UUID.fromString(auth.getName()); }
        catch (IllegalArgumentException ignored) { return null; }
    }
}
