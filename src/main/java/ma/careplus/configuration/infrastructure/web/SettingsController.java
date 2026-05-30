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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
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
            /** V032 — when true, agendas + vaccination queue are filtered per-practitioner. */
            boolean agendaStrictIsolation,
            /** V034 — CABINET / CLINIQUE / HOPITAL / CENTRE_MEDICAL / AUTRE. Drives header label in IHM + PDFs. */
            String establishmentType,
            /** V034 — true si le service de radiologie est interne (sera utilisé par le routing prescription). */
            boolean imagingInternal,
            /** V034 — true si le laboratoire d'analyses est interne. */
            boolean labInternal,
            /** V057 — true si l'établissement fournit des médicaments en interne (pharmacie). */
            boolean pharmacyInternal,
            /** V036 — codes de rôle autorisés à voir les patients sans médecin référent vaccination. */
            List<String> vaccinationOrphanVisibleRoles,
            /** V039 — codes de rôle autorisés à voir les grossesses sans médecin référent. */
            List<String> pregnancyOrphanVisibleRoles,
            /** V037 — true si un logo est configuré (bytes accessibles via GET /api/settings/clinic/logo). */
            boolean hasLogo,
            /** V042 — Registre du Commerce, mention légale optionnelle sur les factures. */
            String rc,
            /** V042 — Identifiant Fiscal (IF). Obligatoire sur toute facture émise au Maroc. */
            String ifNo,
            /** V042 — Forme juridique du cabinet (Profession libérale / SCM / SCP / SARL médicale). */
            String legalForm,
            /** V043 — Logo placement on PDFs: HEADER | FOOTER | WATERMARK | NONE. */
            String logoPosition,
            /** V054 — true => module hospitalisation (lits, séjours) actif. */
            boolean hospitalizationEnabled,
            /** V056 — règle de comptage des journées facturables : NUITS | JOURS_ENTAMES. */
            String stayBillingDayRule,
            /** V056 — rôles autorisés à voir les séjours sans médecin référent (cloisonnement). */
            List<String> hospitalizationOrphanVisibleRoles,
            /** V070 — codes des modules désactivés par l'admin (vide = tous activés). */
            List<String> disabledModules,
            /** V071 — langue de l'application (fr|en|ar|es). Réglée par le super admin. */
            String language,
            /** V072 — apparence (JSON : police / ambiance / accent / mode sombre). Réglée par le super admin. */
            String appearance
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
            Boolean labInternal,
            /** V057 — capacité pharmacie interne. Optional : null = pas de changement. */
            Boolean pharmacyInternal,
            /**
             * V036 — codes de rôle autorisés à voir les patients sans médecin référent vaccination
             * (applicable seulement quand agenda_strict_isolation = TRUE). Valeurs acceptées :
             * MEDECIN, ADMIN, SECRETAIRE, ASSISTANT. Optional : null = pas de changement.
             */
            List<@Pattern(regexp = "MEDECIN|ADMIN|SECRETAIRE|ASSISTANT") String> vaccinationOrphanVisibleRoles,

            /**
             * V039 — codes de rôle autorisés à voir les grossesses sans médecin référent
             * (applicable seulement quand agenda_strict_isolation = TRUE). Mêmes valeurs
             * acceptées que vaccinationOrphanVisibleRoles. Optional : null = pas de changement.
             */
            List<@Pattern(regexp = "MEDECIN|ADMIN|SECRETAIRE|ASSISTANT") String> pregnancyOrphanVisibleRoles,
            /** V042 — Registre du Commerce. Optional. */
            @Size(max = 64) String rc,
            /** V042 — Identifiant Fiscal. Optional. */
            @Size(max = 64) String ifNo,
            /** V042 — Forme juridique. Optional. */
            @Size(max = 64) String legalForm,
            /** V054 — capacité hospitalisation. Optional : null = pas de changement. */
            Boolean hospitalizationEnabled,
            /** V056 — règle journées. Optional : null = pas de changement. */
            @Pattern(regexp = "NUITS|JOURS_ENTAMES") String stayBillingDayRule,
            /** V056 — rôles voyant les séjours orphelins. Optional : null = pas de changement. */
            List<@Pattern(regexp = "MEDECIN|ADMIN|SECRETAIRE|ASSISTANT") String> hospitalizationOrphanVisibleRoles,
            /**
             * V070 — modules désactivés (vide = tous activés). Optional : null = pas
             * de changement. Valeurs débrayables uniquement (modules secondaires).
             */
            List<@Pattern(regexp = "vaccinations|grossesses|stock|messages|assistant|charges") String> disabledModules,
            /** V071 — langue de l'application. Optional : null = pas de changement. Protégé super admin. */
            @Pattern(regexp = "fr|en|ar|es") String language,
            /** V072 — apparence (JSON). Optional : null = pas de changement. Protégé super admin. */
            @Size(max = 2000) String appearance
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
                            + "agenda_strict_isolation, establishment_type, imaging_internal, lab_internal, "
                            + "pharmacy_internal, "
                            + "vaccination_orphan_visible_roles, pregnancy_orphan_visible_roles, "
                            + "(logo_blob IS NOT NULL) AS has_logo, "
                            + "rc, if_no, legal_form, logo_position, hospitalization_enabled, "
                            + "stay_billing_day_rule, hospitalization_orphan_visible_roles, "
                            + "disabled_modules, language, appearance "
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
                            rs.getBoolean("lab_internal"),
                            rs.getBoolean("pharmacy_internal"),
                            readStringArray(rs, "vaccination_orphan_visible_roles"),
                            readStringArray(rs, "pregnancy_orphan_visible_roles"),
                            rs.getBoolean("has_logo"),
                            rs.getString("rc"),
                            rs.getString("if_no"),
                            rs.getString("legal_form"),
                            rs.getString("logo_position"),
                            rs.getBoolean("hospitalization_enabled"),
                            rs.getString("stay_billing_day_rule"),
                            readStringArray(rs, "hospitalization_orphan_visible_roles"),
                            readStringArray(rs, "disabled_modules"),
                            rs.getString("language"),
                            rs.getString("appearance")));
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
        boolean finalPharmacyInternal;
        List<String> finalOrphanRoles;
        List<String> finalPregnancyOrphanRoles;
        boolean finalHospitalizationEnabled;
        String finalStayBillingDayRule;
        List<String> finalHospOrphanRoles;
        List<String> finalDisabledModules;
        String finalLanguage;
        String finalAppearance;
        if (existing != null && existing > 0) {
            id = jdbc.queryForObject(
                    "SELECT id FROM configuration_clinic_settings LIMIT 1", UUID.class);
            // V069 — garde SUPER_ADMIN sur les sections sensibles (Identité du centre,
            // Services internes, Hospitalisation). Un ADMIN normal peut toujours
            // émettre un partial-update qui NE touche QUE des champs non protégés
            // (cloisonnement agenda, rôles orphelins) : on ne bloque que si une
            // valeur protégée change réellement par rapport à l'état en base.
            requireSuperAdminIfProtectedChanges(id, req);
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
            if (req.pharmacyInternal() == null) {
                finalPharmacyInternal = Boolean.TRUE.equals(jdbc.queryForObject(
                        "SELECT pharmacy_internal FROM configuration_clinic_settings WHERE id = ?",
                        Boolean.class, id));
            } else {
                finalPharmacyInternal = req.pharmacyInternal();
            }
            if (req.vaccinationOrphanVisibleRoles() == null) {
                finalOrphanRoles = jdbc.queryForObject(
                        "SELECT vaccination_orphan_visible_roles FROM configuration_clinic_settings WHERE id = ?",
                        (rs, i) -> readStringArray(rs, "vaccination_orphan_visible_roles"), id);
            } else {
                finalOrphanRoles = List.copyOf(req.vaccinationOrphanVisibleRoles());
            }
            if (req.pregnancyOrphanVisibleRoles() == null) {
                finalPregnancyOrphanRoles = jdbc.queryForObject(
                        "SELECT pregnancy_orphan_visible_roles FROM configuration_clinic_settings WHERE id = ?",
                        (rs, i) -> readStringArray(rs, "pregnancy_orphan_visible_roles"), id);
            } else {
                finalPregnancyOrphanRoles = List.copyOf(req.pregnancyOrphanVisibleRoles());
            }
            if (req.hospitalizationEnabled() == null) {
                finalHospitalizationEnabled = Boolean.TRUE.equals(jdbc.queryForObject(
                        "SELECT hospitalization_enabled FROM configuration_clinic_settings WHERE id = ?",
                        Boolean.class, id));
            } else {
                finalHospitalizationEnabled = req.hospitalizationEnabled();
            }
            if (req.stayBillingDayRule() == null) {
                finalStayBillingDayRule = jdbc.queryForObject(
                        "SELECT stay_billing_day_rule FROM configuration_clinic_settings WHERE id = ?",
                        String.class, id);
            } else {
                finalStayBillingDayRule = req.stayBillingDayRule();
            }
            if (req.hospitalizationOrphanVisibleRoles() == null) {
                finalHospOrphanRoles = jdbc.queryForObject(
                        "SELECT hospitalization_orphan_visible_roles FROM configuration_clinic_settings WHERE id = ?",
                        (rs, i) -> readStringArray(rs, "hospitalization_orphan_visible_roles"), id);
            } else {
                finalHospOrphanRoles = List.copyOf(req.hospitalizationOrphanVisibleRoles());
            }
            if (req.disabledModules() == null) {
                finalDisabledModules = jdbc.queryForObject(
                        "SELECT disabled_modules FROM configuration_clinic_settings WHERE id = ?",
                        (rs, i) -> readStringArray(rs, "disabled_modules"), id);
            } else {
                finalDisabledModules = List.copyOf(req.disabledModules());
            }
            if (req.language() == null) {
                finalLanguage = jdbc.queryForObject(
                        "SELECT language FROM configuration_clinic_settings WHERE id = ?",
                        String.class, id);
            } else {
                finalLanguage = req.language();
            }
            if (req.appearance() == null) {
                finalAppearance = jdbc.queryForObject(
                        "SELECT appearance FROM configuration_clinic_settings WHERE id = ?",
                        String.class, id);
            } else {
                finalAppearance = req.appearance();
            }
            jdbc.update(
                    "UPDATE configuration_clinic_settings SET name=?, address=?, city=?, "
                            + "phone=?, email=?, inpe=?, cnom=?, ice=?, rib=?, "
                            + "agenda_strict_isolation=?, establishment_type=?, "
                            + "imaging_internal=?, lab_internal=?, pharmacy_internal=?, "
                            + "vaccination_orphan_visible_roles=?, "
                            + "pregnancy_orphan_visible_roles=?, "
                            + "rc=COALESCE(?, rc), if_no=COALESCE(?, if_no), "
                            + "legal_form=COALESCE(?, legal_form), "
                            + "hospitalization_enabled=?, "
                            + "stay_billing_day_rule=?, "
                            + "hospitalization_orphan_visible_roles=?, "
                            + "disabled_modules=?, "
                            + "language=?, "
                            + "appearance=?, "
                            + "updated_at=now() "
                            + "WHERE id=?",
                    req.name(), req.address(), req.city(), req.phone(),
                    nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                    nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                    nullIfBlank(req.rib()), finalAgendaIsolation,
                    finalEstablishmentType, finalImagingInternal, finalLabInternal,
                    finalPharmacyInternal,
                    finalOrphanRoles.toArray(String[]::new),
                    finalPregnancyOrphanRoles.toArray(String[]::new),
                    nullIfBlank(req.rc()), nullIfBlank(req.ifNo()), nullIfBlank(req.legalForm()),
                    finalHospitalizationEnabled,
                    finalStayBillingDayRule,
                    finalHospOrphanRoles.toArray(String[]::new),
                    finalDisabledModules.toArray(String[]::new),
                    finalLanguage,
                    finalAppearance,
                    id);
        } else {
            id = UUID.randomUUID();
            // First-row insert: respect the caller value if provided, else defaults.
            finalAgendaIsolation = Boolean.TRUE.equals(req.agendaStrictIsolation());
            finalEstablishmentType = req.establishmentType() != null ? req.establishmentType() : "CABINET";
            finalImagingInternal = Boolean.TRUE.equals(req.imagingInternal());
            finalLabInternal = Boolean.TRUE.equals(req.labInternal());
            finalPharmacyInternal = Boolean.TRUE.equals(req.pharmacyInternal());
            finalOrphanRoles = req.vaccinationOrphanVisibleRoles() != null
                    ? List.copyOf(req.vaccinationOrphanVisibleRoles())
                    : List.of("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT");
            finalPregnancyOrphanRoles = req.pregnancyOrphanVisibleRoles() != null
                    ? List.copyOf(req.pregnancyOrphanVisibleRoles())
                    : List.of("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT");
            finalHospitalizationEnabled = Boolean.TRUE.equals(req.hospitalizationEnabled());
            finalStayBillingDayRule = req.stayBillingDayRule() != null ? req.stayBillingDayRule() : "NUITS";
            finalHospOrphanRoles = req.hospitalizationOrphanVisibleRoles() != null
                    ? List.copyOf(req.hospitalizationOrphanVisibleRoles())
                    : List.of("MEDECIN", "ADMIN", "SECRETAIRE", "ASSISTANT");
            finalDisabledModules = req.disabledModules() != null
                    ? List.copyOf(req.disabledModules())
                    : List.of();
            finalLanguage = req.language() != null ? req.language() : "fr";
            finalAppearance = req.appearance();
            jdbc.update(
                    "INSERT INTO configuration_clinic_settings "
                            + "(id, name, address, city, phone, email, inpe, cnom, ice, rib, "
                            + " agenda_strict_isolation, establishment_type, imaging_internal, lab_internal, "
                            + " pharmacy_internal, "
                            + " vaccination_orphan_visible_roles, pregnancy_orphan_visible_roles, "
                            + " rc, if_no, legal_form, hospitalization_enabled, "
                            + " stay_billing_day_rule, hospitalization_orphan_visible_roles, "
                            + " disabled_modules, language, appearance) "
                            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    id, req.name(), req.address(), req.city(), req.phone(),
                    nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                    nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                    nullIfBlank(req.rib()), finalAgendaIsolation,
                    finalEstablishmentType, finalImagingInternal, finalLabInternal,
                    finalPharmacyInternal,
                    finalOrphanRoles.toArray(String[]::new),
                    finalPregnancyOrphanRoles.toArray(String[]::new),
                    nullIfBlank(req.rc()), nullIfBlank(req.ifNo()), nullIfBlank(req.legalForm()),
                    finalHospitalizationEnabled,
                    finalStayBillingDayRule,
                    finalHospOrphanRoles.toArray(String[]::new),
                    finalDisabledModules.toArray(String[]::new),
                    finalLanguage,
                    finalAppearance);
        }
        boolean hasLogo = Boolean.TRUE.equals(jdbc.queryForObject(
                "SELECT (logo_blob IS NOT NULL) FROM configuration_clinic_settings WHERE id = ?",
                Boolean.class, id));
        // Re-read final RC/IF/legalForm/logoPosition because we used COALESCE on update.
        String[] finalReadback = jdbc.queryForObject(
                "SELECT rc, if_no, legal_form, logo_position FROM configuration_clinic_settings WHERE id = ?",
                (rs, i) -> new String[] {
                        rs.getString("rc"),
                        rs.getString("if_no"),
                        rs.getString("legal_form"),
                        rs.getString("logo_position"),
                },
                id);
        return new ClinicSettingsView(
                id, req.name(), req.address(), req.city(), req.phone(),
                nullIfBlank(req.email()), nullIfBlank(req.inpe()),
                nullIfBlank(req.cnom()), nullIfBlank(req.ice()),
                nullIfBlank(req.rib()), finalAgendaIsolation,
                finalEstablishmentType, finalImagingInternal, finalLabInternal,
                finalPharmacyInternal,
                finalOrphanRoles, finalPregnancyOrphanRoles, hasLogo,
                finalReadback[0], finalReadback[1], finalReadback[2], finalReadback[3],
                finalHospitalizationEnabled,
                finalStayBillingDayRule, finalHospOrphanRoles, finalDisabledModules,
                finalLanguage, finalAppearance);
    }

    /**
     * V069 — refuse les modifications des sections « Identité du centre médical »,
     * « Services internes » et « Hospitalisation » à un administrateur qui n'est pas
     * SUPER_ADMIN. On compare les valeurs entrantes à l'état en base : si rien de
     * protégé ne change (cas d'un toggle cloisonnement / rôles orphelins émis par un
     * ADMIN normal), on laisse passer.
     */
    private void requireSuperAdminIfProtectedChanges(UUID id, UpdateClinicSettingsRequest req) {
        if (isSuperAdmin()) return;
        var cur = jdbc.queryForMap(
                "SELECT name, address, city, phone, email, inpe, cnom, ice, rib, "
                        + "establishment_type, imaging_internal, lab_internal, pharmacy_internal, "
                        + "hospitalization_enabled, rc, if_no, legal_form, language, appearance "
                        + "FROM configuration_clinic_settings WHERE id = ?", id);
        boolean changed =
                // Identité du centre médical (champs toujours écrits depuis la requête).
                textChanged(req.name(), cur.get("name"))
                || textChanged(req.address(), cur.get("address"))
                || textChanged(req.city(), cur.get("city"))
                || textChanged(req.phone(), cur.get("phone"))
                || textChanged(req.email(), cur.get("email"))
                || textChanged(req.inpe(), cur.get("inpe"))
                || textChanged(req.cnom(), cur.get("cnom"))
                || textChanged(req.ice(), cur.get("ice"))
                || textChanged(req.rib(), cur.get("rib"))
                // rc / if_no / legal_form : COALESCE côté UPDATE → null = inchangé.
                || (req.rc() != null && textChanged(req.rc(), cur.get("rc")))
                || (req.ifNo() != null && textChanged(req.ifNo(), cur.get("if_no")))
                || (req.legalForm() != null && textChanged(req.legalForm(), cur.get("legal_form")))
                // Services internes + type d'établissement + hospitalisation : null = inchangé.
                || (req.establishmentType() != null
                        && textChanged(req.establishmentType(), cur.get("establishment_type")))
                || (req.imagingInternal() != null
                        && req.imagingInternal() != toBool(cur.get("imaging_internal")))
                || (req.labInternal() != null
                        && req.labInternal() != toBool(cur.get("lab_internal")))
                || (req.pharmacyInternal() != null
                        && req.pharmacyInternal() != toBool(cur.get("pharmacy_internal")))
                || (req.hospitalizationEnabled() != null
                        && req.hospitalizationEnabled() != toBool(cur.get("hospitalization_enabled")))
                // V071 — la langue de l'application est réglée par le super admin seul.
                || (req.language() != null && textChanged(req.language(), cur.get("language")))
                // V072 — l'apparence (thème) est réglée par le super admin seul.
                || (req.appearance() != null && textChanged(req.appearance(), cur.get("appearance")));
        if (changed) {
            throw new BusinessException(
                    "SUPER_ADMIN_REQUIRED",
                    "Seul un super administrateur peut modifier l'identité du centre, "
                            + "les services internes, l'hospitalisation, la langue et l'apparence.",
                    HttpStatus.FORBIDDEN.value());
        }
    }

    private static boolean isSuperAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (GrantedAuthority a : auth.getAuthorities()) {
            if ("ROLE_SUPER_ADMIN".equals(a.getAuthority())) return true;
        }
        return false;
    }

    /** Compare une valeur texte entrante à la valeur en base, blanc ≡ null. */
    private static boolean textChanged(String incoming, Object current) {
        String a = incoming == null || incoming.isBlank() ? null : incoming;
        String b = current == null || current.toString().isBlank() ? null : current.toString();
        return a == null ? b != null : !a.equals(b);
    }

    private static boolean toBool(Object o) {
        return o instanceof Boolean b && b;
    }

    /** Reads a Postgres VARCHAR[] column into a Java {@link List} (empty list if NULL). */
    private static List<String> readStringArray(java.sql.ResultSet rs, String col) throws java.sql.SQLException {
        java.sql.Array arr = rs.getArray(col);
        if (arr == null) return List.of();
        Object raw = arr.getArray();
        if (raw instanceof String[] strs) return List.of(strs);
        return List.of();
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

    // ── Logo établissement (V037) ─────────────────────────────────────────────
    //
    // Stocké dans configuration_clinic_settings.logo_blob (BYTEA), avec son MIME
    // et son horodatage. Pattern identique à la signature médecin (V031/V035) :
    // bytes en DB, single-row, validation taille + MIME côté backend.
    //
    // Le logo est ensuite injecté en base64 dans le contexte Thymeleaf de chaque
    // PDF (ordonnance, certificat, carnet vaccination) — header gauche.

    /** MIME types autorisés pour le logo. Pas de SVG en v1 (cf. design doc — BACKLOG). */
    private static final Set<String> LOGO_ALLOWED_MIMES = Set.of(
            "image/png", "image/jpeg");

    /** Limite stricte côté backend, indépendante de la limite multipart globale. */
    private static final long LOGO_MAX_BYTES = 500L * 1024L; // 500 Ko

    public record LogoMetaView(
            String mime,
            OffsetDateTime uploadedAt,
            int sizeBytes,
            /** V043 — HEADER | FOOTER | WATERMARK | NONE. Default HEADER. */
            String position
    ) {}

    public record UpdateLogoPositionRequest(
            @NotBlank
            @Pattern(regexp = "HEADER|FOOTER|WATERMARK|NONE",
                    message = "must be HEADER, FOOTER, WATERMARK, or NONE")
            String position
    ) {}

    /**
     * GET /api/settings/clinic/logo/meta — métadonnées (existence + MIME + date).
     * Tous rôles auth. 204 si pas de logo configuré. Permet au frontend d'afficher
     * un état "Aucun logo" sans tirer les bytes.
     */
    @GetMapping("/api/settings/clinic/logo/meta")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<LogoMetaView> getLogoMeta() {
        try {
            LogoMetaView v = jdbc.queryForObject(
                    "SELECT logo_mime, logo_uploaded_at, logo_position, "
                            + "COALESCE(octet_length(logo_blob), 0) AS sz "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        String mime = rs.getString("logo_mime");
                        if (mime == null) return null;
                        OffsetDateTime ts = rs.getObject("logo_uploaded_at", OffsetDateTime.class);
                        return new LogoMetaView(mime, ts, rs.getInt("sz"),
                                rs.getString("logo_position"));
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
     * GET /api/settings/clinic/logo — bytes bruts (image/png|jpeg).
     * 204 si pas de logo configuré. Tous rôles auth.
     */
    @GetMapping("/api/settings/clinic/logo")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<byte[]> getLogo() {
        try {
            return jdbc.queryForObject(
                    "SELECT logo_blob, logo_mime "
                            + "FROM configuration_clinic_settings LIMIT 1",
                    (rs, i) -> {
                        byte[] blob = rs.getBytes("logo_blob");
                        String mime = rs.getString("logo_mime");
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
     * PUT /api/settings/clinic/logo — upload (multipart/form-data, champ "file").
     * ADMIN seul. Validations :
     *   • MIME ∈ {image/png, image/jpeg}
     *   • taille ≤ 500 Ko
     */
    @PutMapping(value = "/api/settings/clinic/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LogoMetaView> uploadLogo(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("LOGO-EMPTY", "Fichier vide.", 400);
        }
        String mime = file.getContentType();
        if (mime == null || !LOGO_ALLOWED_MIMES.contains(mime.toLowerCase())) {
            throw new BusinessException("LOGO-MIME",
                    "Format non autorisé. Utiliser PNG ou JPEG.", 400);
        }
        if (file.getSize() > LOGO_MAX_BYTES) {
            throw new BusinessException("LOGO-TOO-BIG",
                    "Image trop volumineuse (max 500 Ko).", 400);
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("LOGO-IO",
                    "Lecture du fichier impossible.", 400);
        }
        if (bytes.length > LOGO_MAX_BYTES) {
            throw new BusinessException("LOGO-TOO-BIG",
                    "Image trop volumineuse (max 500 Ko).", 400);
        }

        // Upsert : crée la ligne cabinet vide si elle n'existe pas encore — cas
        // d'un onboarding où l'admin configure d'abord le logo avant l'identité.
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM configuration_clinic_settings", Integer.class);
        if (existing == null || existing == 0) {
            jdbc.update(
                    "INSERT INTO configuration_clinic_settings "
                            + "(id, name, address, city, phone, logo_blob, logo_mime, logo_uploaded_at) "
                            + "VALUES (?, '', '', '', '', ?, ?, now())",
                    UUID.randomUUID(), bytes, mime.toLowerCase());
        } else {
            jdbc.update(
                    "UPDATE configuration_clinic_settings "
                            + "SET logo_blob = ?, logo_mime = ?, "
                            + "    logo_uploaded_at = now(), updated_at = now()",
                    bytes, mime.toLowerCase());
        }

        // Re-read both uploadedAt and the existing position — the upload only
        // touches the blob/mime, leaving the position field untouched.
        var meta = jdbc.queryForObject(
                "SELECT logo_uploaded_at, logo_position FROM configuration_clinic_settings LIMIT 1",
                (rs, i) -> new Object[] {
                        rs.getObject("logo_uploaded_at", OffsetDateTime.class),
                        rs.getString("logo_position"),
                });
        return ResponseEntity.ok(new LogoMetaView(
                mime.toLowerCase(),
                (OffsetDateTime) meta[0],
                bytes.length,
                (String) meta[1]));
    }

    /**
     * DELETE /api/settings/clinic/logo — supprime le logo configuré.
     * ADMIN seul. 204 même si aucun logo n'existait (idempotent).
     */
    @DeleteMapping("/api/settings/clinic/logo")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteLogo() {
        jdbc.update(
                "UPDATE configuration_clinic_settings "
                        + "SET logo_blob = NULL, logo_mime = NULL, "
                        + "    logo_uploaded_at = NULL, updated_at = now()");
        return ResponseEntity.noContent().build();
    }

    /**
     * PUT /api/settings/clinic/logo/position — change où le logo apparaît sur
     * les PDFs (HEADER / FOOTER / WATERMARK / NONE). Indépendant de l'upload :
     * permet à l'admin de pré-régler le placement avant d'avoir chargé le
     * logo, ou de le déplacer après coup sans re-téléverser.
     * ADMIN seul.
     */
    @PutMapping("/api/settings/clinic/logo/position")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UpdateLogoPositionRequest> updateLogoPosition(
            @Valid @RequestBody UpdateLogoPositionRequest req) {
        // Upsert : crée la ligne cabinet si elle n'existe pas, pour le même
        // motif que l'upload logo (admin peut configurer avant l'identité).
        Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM configuration_clinic_settings", Integer.class);
        if (existing == null || existing == 0) {
            jdbc.update(
                    "INSERT INTO configuration_clinic_settings "
                            + "(id, name, address, city, phone, logo_position) "
                            + "VALUES (?, '', '', '', '', ?)",
                    UUID.randomUUID(), req.position());
        } else {
            jdbc.update(
                    "UPDATE configuration_clinic_settings "
                            + "SET logo_position = ?, updated_at = now()",
                    req.position());
        }
        return ResponseEntity.ok(req);
    }

    private static String nullIfBlank(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
