package ma.careplus.configuration.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import ma.careplus.shared.error.BusinessException;

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
            String rib,
            /** V032 — when true, agendas are filtered per-practitioner via identity_user_assignment. */
            boolean agendaStrictIsolation,
            /** V034 — CABINET / CLINIQUE / HOPITAL / CENTRE_MEDICAL / AUTRE. Drives header label in IHM + PDFs. */
            String establishmentType,
            /** V034 — true si le service de radiologie est interne (sera utilisé par le routing prescription). */
            boolean imagingInternal,
            /** V034 — true si le laboratoire d'analyses est interne. */
            boolean labInternal
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
            @Size(max = 32) String rib,
            /**
             * V032 — toggle the "strict agenda isolation" mode. Optional in the
             * payload: {@code null} keeps the current value (legacy clients that
             * only send the identity fields stay unchanged).
             */
            Boolean agendaStrictIsolation,
            /** V034 — type d'établissement. Optional : null = pas de changement. */
            @Pattern(regexp = "CABINET|CLINIQUE|HOPITAL|CENTRE_MEDICAL|AUTRE")
            String establishmentType,
            /** V034 — capacité radiologie interne. Optional : null = pas de changement. */
            Boolean imagingInternal,
            /** V034 — capacité laboratoire interne. Optional : null = pas de changement. */
            Boolean labInternal
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
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<ClinicSettingsView> getClinic() {
        try {
            ClinicSettingsView v = jdbc.queryForObject(
                    "SELECT id, name, address, city, phone, email, inpe, cnom, ice, rib, "
                            + "agenda_strict_isolation, establishment_type, imaging_internal, lab_internal "
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
                            rs.getString("rib"),
                            rs.getBoolean("agenda_strict_isolation"),
                            rs.getString("establishment_type"),
                            rs.getBoolean("imaging_internal"),
                            rs.getBoolean("lab_internal")));
            return ResponseEntity.ok(v);
        } catch (EmptyResultDataAccessException e) {
            // No row yet — return 204 so the frontend can render the empty
            // form for the very first onboarding step.
            return ResponseEntity.noContent().build();
        }
    }

    @PutMapping("/api/settings/clinic")
    @PreAuthorize("hasRole('ADMIN')")
    public ClinicSettingsView updateClinic(@Valid @RequestBody UpdateClinicSettingsRequest req) {
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM configuration_clinic_settings", Integer.class);
        UUID id;
        // Read current values if the corresponding field is omitted in the payload —
        // legacy callers that don't yet know about the new fields don't accidentally reset them.
        boolean finalAgendaIsolation;
        String finalEstablishmentType;
        boolean finalImagingInternal;
        boolean finalLabInternal;
        if (existing != null && existing > 0) {
            id = jdbc.queryForObject(
                    "SELECT id FROM configuration_clinic_settings LIMIT 1", UUID.class);
            if (req.agendaStrictIsolation() == null) {
                finalAgendaIsolation = Boolean.TRUE.equals(jdbc.queryForObject(
                        "SELECT agenda_strict_isolation FROM configuration_clinic_settings WHERE id = ?",
                        Boolean.class, id));
            } else {
                finalAgendaIsolation = req.agendaStrictIsolation();
            }
            if (req.establishmentType() == null) {
                finalEstablishmentType = jdbc.queryForObject(
                        "SELECT establishment_type FROM configuration_clinic_settings WHERE id = ?",
                        String.class, id);
            } else {
                finalEstablishmentType = req.establishmentType();
            }
            if (req.imagingInternal() == null) {
                finalImagingInternal = Boolean.TRUE.equals(jdbc.queryForObject(
                        "SELECT imaging_internal FROM configuration_clinic_settings WHERE id = ?",
                        Boolean.class, id));
            } else {
                finalImagingInternal = req.imagingInternal();
            }
            if (req.labInternal() == null) {
                finalLabInternal = Boolean.TRUE.equals(jdbc.queryForObject(
                        "SELECT lab_internal FROM configuration_clinic_settings WHERE id = ?",
                        Boolean.class, id));
            } else {
                finalLabInternal = req.labInternal();
            }
            jdbc.update(
                    "UPDATE configuration_clinic_settings SET name=?, address=?, city=?, "
                            + "phone=?, email=?, inpe=?, cnom=?, ice=?, rib=?, "
                            + "agenda_strict_isolation=?, establishment_type=?, "
                            + "imaging_internal=?, lab_internal=?, updated_at=now() "
                            + "WHERE id=?",
                    req.name(), req.address(), req.city(), req.phone(),
                    nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                    nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                    nullIfBlank(req.rib()), finalAgendaIsolation,
                    finalEstablishmentType, finalImagingInternal, finalLabInternal, id);
        } else {
            id = UUID.randomUUID();
            // First-row insert: respect the caller value if provided, else defaults.
            finalAgendaIsolation = Boolean.TRUE.equals(req.agendaStrictIsolation());
            finalEstablishmentType = req.establishmentType() != null ? req.establishmentType() : "CABINET";
            finalImagingInternal = Boolean.TRUE.equals(req.imagingInternal());
            finalLabInternal = Boolean.TRUE.equals(req.labInternal());
            jdbc.update(
                    "INSERT INTO configuration_clinic_settings "
                            + "(id, name, address, city, phone, email, inpe, cnom, ice, rib, "
                            + " agenda_strict_isolation, establishment_type, imaging_internal, lab_internal) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    id, req.name(), req.address(), req.city(), req.phone(),
                    nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                    nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                    nullIfBlank(req.rib()), finalAgendaIsolation,
                    finalEstablishmentType, finalImagingInternal, finalLabInternal);
        }
        return new ClinicSettingsView(
                id, req.name(), req.address(), req.city(), req.phone(),
                nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                nullIfBlank(req.rib()), finalAgendaIsolation,
                finalEstablishmentType, finalImagingInternal, finalLabInternal);
    }

    // ── Tier discount ─────────────────────────────────────────────────────────

    @GetMapping("/api/settings/tiers")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public List<TierConfigView> listTiers() {
        return jdbc.query(
                "SELECT id, tier, discount_percent FROM config_patient_tier ORDER BY tier",
                (rs, i) -> new TierConfigView(
                        (UUID) rs.getObject("id"),
                        rs.getString("tier"),
                        rs.getBigDecimal("discount_percent")));
    }

    @PutMapping("/api/settings/tiers/{tier}")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
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

    // ── Role × permission matrix (QA3-3 v1) ───────────────────────────────────

    public record RolePermissionView(String roleCode, String permission, boolean granted) {}

    public record UpdateRolePermissionsRequest(
            @jakarta.validation.constraints.NotEmpty
            List<@Valid PermissionFlag> permissions
    ) {}

    public record PermissionFlag(
            @NotBlank @Size(max = 64) String permission,
            @jakarta.validation.constraints.NotNull Boolean granted
    ) {}

    @GetMapping("/api/settings/role-permissions")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<RolePermissionView>> listRolePermissions() {
        List<RolePermissionView> rows = jdbc.query(
                "SELECT role_code, permission, granted FROM identity_role_permission "
                        + "ORDER BY role_code, permission",
                (rs, i) -> new RolePermissionView(
                        rs.getString("role_code"),
                        rs.getString("permission"),
                        rs.getBoolean("granted")));
        return ResponseEntity.ok(rows);
    }

    @PutMapping("/api/settings/role-permissions/{roleCode}")
    @PreAuthorize("hasAnyRole('ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<List<RolePermissionView>> updateRolePermissions(
            @PathVariable String roleCode,
            @Valid @RequestBody UpdateRolePermissionsRequest req) {
        // Validate role code against the canonical list — anything else is rejected.
        if (!List.of("SECRETAIRE", "ASSISTANT", "MEDECIN", "ADMIN").contains(roleCode)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
        for (PermissionFlag flag : req.permissions()) {
            int updated = jdbc.update(
                    "UPDATE identity_role_permission SET granted = ?, updated_at = now() "
                            + "WHERE role_code = ? AND permission = ?",
                    flag.granted(), roleCode, flag.permission());
            if (updated == 0) {
                jdbc.update(
                        "INSERT INTO identity_role_permission (role_code, permission, granted) "
                                + "VALUES (?, ?, ?)",
                        roleCode, flag.permission(), flag.granted());
            }
        }
        return listRolePermissions();
    }

    // ── Signature médecin (F16) ───────────────────────────────────────────────
    //
    // Stockée dans configuration_clinic_settings.signature_blob (BYTEA), avec son
    // MIME et son horodatage. Une seule signature par cabinet (table single-row
    // en v1). L'image est ensuite injectée en base64 dans le contexte Thymeleaf
    // de chaque PDF (ordonnance, certificat, carnet vaccination).

    /** MIME types autorisés pour la signature scannée. */
    private static final Set<String> SIGNATURE_ALLOWED_MIMES = Set.of(
            "image/png", "image/jpeg", "image/webp");

    /** Limite stricte côté backend, indépendante de la limite multipart globale. */
    private static final long SIGNATURE_MAX_BYTES = 500L * 1024L; // 500 Ko

    public record SignatureMetaView(String mime, OffsetDateTime uploadedAt, int sizeBytes) {}

    /**
     * GET /api/settings/signature/meta — métadonnées (existence + MIME + date).
     * Tous rôles auth. 204 si pas de signature configurée.
     * Sert au frontend pour afficher l'aperçu sans télécharger les bytes
     * tant qu'il n'en a pas besoin.
     */
    @GetMapping("/api/settings/signature/meta")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<SignatureMetaView> getSignatureMeta() {
        try {
            SignatureMetaView v = jdbc.queryForObject(
                    "SELECT signature_mime, signature_uploaded_at, "
                            + "COALESCE(octet_length(signature_blob), 0) AS sz "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        String mime = rs.getString("signature_mime");
                        if (mime == null) return null;
                        OffsetDateTime ts = rs.getObject("signature_uploaded_at", OffsetDateTime.class);
                        return new SignatureMetaView(mime, ts, rs.getInt("sz"));
                    });
            if (v == null) {
                return ResponseEntity.noContent().build();
            }
            return ResponseEntity.ok(v);
        } catch (EmptyResultDataAccessException e) {
            return ResponseEntity.noContent().build();
        }
    }

    /**
     * GET /api/settings/signature — bytes bruts de l'image (image/png|jpeg|webp).
     * 204 si pas de signature configurée. Tous rôles auth.
     */
    @GetMapping("/api/settings/signature")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<byte[]> getSignature() {
        try {
            return jdbc.queryForObject(
                    "SELECT signature_blob, signature_mime "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        byte[] blob = rs.getBytes("signature_blob");
                        String mime = rs.getString("signature_mime");
                        if (blob == null || mime == null) {
                            return ResponseEntity.<byte[]>noContent().build();
                        }
                        return ResponseEntity.ok()
                                .contentType(MediaType.parseMediaType(mime))
                                .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                                .body(blob);
                    });
        } catch (EmptyResultDataAccessException e) {
            return ResponseEntity.noContent().build();
        }
    }

    /**
     * PUT /api/settings/signature — upload (multipart/form-data, champ "file").
     * ADMIN seul. Validations :
     *   • MIME ∈ {image/png, image/jpeg, image/webp}
     *   • taille ≤ 500 Ko
     */
    @PutMapping(value = "/api/settings/signature", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SignatureMetaView> uploadSignature(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("SIG-EMPTY", "Fichier vide.", 400);
        }
        String mime = file.getContentType();
        if (mime == null || !SIGNATURE_ALLOWED_MIMES.contains(mime.toLowerCase())) {
            throw new BusinessException("SIG-MIME",
                    "Format non autorisé. Utiliser PNG, JPEG ou WEBP.", 400);
        }
        if (file.getSize() > SIGNATURE_MAX_BYTES) {
            throw new BusinessException("SIG-TOO-BIG",
                    "Image trop volumineuse (max 500 Ko).", 400);
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("SIG-IO",
                    "Lecture du fichier impossible.", 400);
        }
        if (bytes.length > SIGNATURE_MAX_BYTES) {
            throw new BusinessException("SIG-TOO-BIG",
                    "Image trop volumineuse (max 500 Ko).", 400);
        }

        // Upsert : crée la ligne cabinet vide si elle n'existe pas encore (un
        // cabinet peut configurer sa signature avant d'avoir saisi son identité,
        // notamment lors d'un onboarding différé).
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM configuration_clinic_settings", Integer.class);
        if (existing == null || existing == 0) {
            jdbc.update(
                    "INSERT INTO configuration_clinic_settings "
                            + "(id, name, address, city, phone, signature_blob, signature_mime, signature_uploaded_at) "
                            + "VALUES (?, '', '', '', '', ?, ?, now())",
                    UUID.randomUUID(), bytes, mime.toLowerCase());
        } else {
            jdbc.update(
                    "UPDATE configuration_clinic_settings "
                            + "SET signature_blob = ?, signature_mime = ?, "
                            + "    signature_uploaded_at = now(), updated_at = now()",
                    bytes, mime.toLowerCase());
        }

        OffsetDateTime ts = jdbc.queryForObject(
                "SELECT signature_uploaded_at FROM configuration_clinic_settings LIMIT 1",
                OffsetDateTime.class);
        return ResponseEntity.ok(new SignatureMetaView(mime.toLowerCase(), ts, bytes.length));
    }

    /**
     * DELETE /api/settings/signature — supprime la signature configurée.
     * ADMIN seul. 204 même si aucune signature n'existait (idempotent).
     */
    @DeleteMapping("/api/settings/signature")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteSignature() {
        jdbc.update(
                "UPDATE configuration_clinic_settings "
                        + "SET signature_blob = NULL, signature_mime = NULL, "
                        + "    signature_uploaded_at = NULL, updated_at = now()");
        return ResponseEntity.noContent().build();
    }

    private static String nullIfBlank(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
