package ma.careplus.configuration.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cabinet-wide settings — clinic identity (header for ordonnance / facture) and
 * patient-tier discount configuration.
 *
 * Schema is single-row in v1 (one cabinet per install). The PUT upserts.
 * Implemented via JdbcTemplate to avoid creating JPA entities for two
 * configuration tables.
 */
@RestController
@Tag(name = "settings", description = "Cabinet settings + patient-tier discount config")
public class SettingsController {

    private final JdbcTemplate jdbc;

    public SettingsController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record ClinicSettingsView(
            UUID id,
            String name,
            String address,
            String city,
            String phone,
            String email,
            String inpe,
            String cnom,
            String ice,
            String rib
    ) {}

    public record UpdateClinicSettingsRequest(
            @NotBlank @Size(max = 255) String name,
            @NotBlank @Size(max = 512) String address,
            @NotBlank @Size(max = 128) String city,
            @NotBlank @Size(max = 32) String phone,
            @Size(max = 255) String email,
            @Size(max = 32) String inpe,
            @Size(max = 32) String cnom,
            @Size(max = 32) String ice,
            @Size(max = 32) String rib
    ) {}

    public record TierConfigView(UUID id, String tier, BigDecimal discountPercent) {}

    public record UpdateTierDiscountRequest(
            @NotBlank @Pattern(regexp = "NORMAL|PREMIUM") String tier,
            @jakarta.validation.constraints.NotNull
            @jakarta.validation.constraints.DecimalMin("0.00")
            @jakarta.validation.constraints.DecimalMax("100.00")
            BigDecimal discountPercent
    ) {}

    // ── Clinic settings ───────────────────────────────────────────────────────

    @GetMapping("/api/settings/clinic")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<ClinicSettingsView> getClinic() {
        try {
            ClinicSettingsView v = jdbc.queryForObject(
                    "SELECT id, name, address, city, phone, email, inpe, cnom, ice, rib "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> new ClinicSettingsView(
                            (UUID) rs.getObject("id"),
                            rs.getString("name"),
                            rs.getString("address"),
                            rs.getString("city"),
                            rs.getString("phone"),
                            rs.getString("email"),
                            rs.getString("inpe"),
                            rs.getString("cnom"),
                            rs.getString("ice"),
                            rs.getString("rib")));
            return ResponseEntity.ok(v);
        } catch (EmptyResultDataAccessException e) {
            // No row yet — return 204 so the frontend can render the empty
            // form for the very first onboarding step.
            return ResponseEntity.noContent().build();
        }
    }

    @PutMapping("/api/settings/clinic")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ClinicSettingsView updateClinic(@Valid @RequestBody UpdateClinicSettingsRequest req) {
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM configuration_clinic_settings", Integer.class);
        UUID id;
        if (existing != null && existing > 0) {
            id = jdbc.queryForObject(
                    "SELECT id FROM configuration_clinic_settings LIMIT 1", UUID.class);
            jdbc.update(
                    "UPDATE configuration_clinic_settings SET name=?, address=?, city=?, "
                            + "phone=?, email=?, inpe=?, cnom=?, ice=?, rib=?, updated_at=now() "
                            + "WHERE id=?",
                    req.name(), req.address(), req.city(), req.phone(),
                    nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                    nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                    nullIfBlank(req.rib()), id);
        } else {
            id = UUID.randomUUID();
            jdbc.update(
                    "INSERT INTO configuration_clinic_settings "
                            + "(id, name, address, city, phone, email, inpe, cnom, ice, rib) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    id, req.name(), req.address(), req.city(), req.phone(),
                    nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                    nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                    nullIfBlank(req.rib()));
        }
        return new ClinicSettingsView(
                id, req.name(), req.address(), req.city(), req.phone(),
                nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                nullIfBlank(req.rib()));
    }

    // ── Tier discount ─────────────────────────────────────────────────────────

    @GetMapping("/api/settings/tiers")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public List<TierConfigView> listTiers() {
        return jdbc.query(
                "SELECT id, tier, discount_percent FROM config_patient_tier ORDER BY tier",
                (rs, i) -> new TierConfigView(
                        (UUID) rs.getObject("id"),
                        rs.getString("tier"),
                        rs.getBigDecimal("discount_percent")));
    }

    @PutMapping("/api/settings/tiers/{tier}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<TierConfigView> updateTierDiscount(
            @PathVariable String tier,
            @Valid @RequestBody UpdateTierDiscountRequest req) {
        if (!tier.equals(req.tier())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        int updated = jdbc.update(
                "UPDATE config_patient_tier SET discount_percent = ?, updated_at = now() "
                        + "WHERE tier = ?",
                req.discountPercent(), req.tier());
        if (updated == 0) {
            UUID id = UUID.randomUUID();
            jdbc.update(
                    "INSERT INTO config_patient_tier (id, tier, discount_percent) VALUES (?, ?, ?)",
                    id, req.tier(), req.discountPercent());
        }
        UUID id = jdbc.queryForObject(
                "SELECT id FROM config_patient_tier WHERE tier = ?", UUID.class, req.tier());
        return ResponseEntity.ok(new TierConfigView(id, req.tier(), req.discountPercent()));
    }

    private static String nullIfBlank(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
