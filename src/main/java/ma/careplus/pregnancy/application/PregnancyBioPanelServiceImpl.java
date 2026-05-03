package ma.careplus.pregnancy.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import ma.careplus.pregnancy.infrastructure.persistence.PregnancyRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Bio panel template builder — Étape 3.
 *
 * <p>Looks up each test by code in {@code catalog_lab_test}. When a code exists,
 * {@code catalogCode + label} are populated from the catalog row. When a code is
 * absent (e.g. STREPTO_B not yet in catalog), {@code catalogCode = null} and
 * {@code prescription} holds the human-readable name as a free-text fallback.
 *
 * <p>The inline {@code CODE_TO_LABEL} map is the single source of truth for the
 * PSGA-aligned test list for v1. A later iteration could move this to a repeatable
 * Flyway seed {@code R__seed_pregnancy_bio_panel.sql}.
 *
 * <p>Uses JdbcTemplate to query {@code catalog_lab_test} directly — avoids coupling
 * to the catalog module's JPA entities (cross-module concern). Same pattern as
 * {@code VaccinationQueueServiceImpl} using PatientRepository.
 */
@Service
@Transactional(readOnly = true)
public class PregnancyBioPanelServiceImpl implements PregnancyBioPanelService {

    private static final Set<String> VALID_TRIMESTERS = Set.of("T1", "T2", "T3");

    /**
     * PSGA bio panel per trimester.
     * Format: code → human-readable label (used as fallback if code not in catalog).
     * Order matters — it is preserved in the output.
     */
    private static final Map<String, String> T1_PANEL = Map.of(
            "GROUPE_RH",  "Groupage ABO + Rhésus",
            "RAI",        "RAI (recherche d'agglutinines irrégulières)",
            "SERO_SYPH",  "Sérologie syphilis (TPHA-VDRL)",
            "SERO_HIV",   "Sérologie VIH (consentement requis)",
            "SERO_RUB",   "Sérologie rubéole (IgG/IgM)",
            "SERO_TOXO",  "Sérologie toxoplasmose (IgG/IgM)",
            "SERO_HEPB",  "Sérologie hépatite B (AgHBs)",
            "GLY",        "Glycémie à jeun"
    );
    private static final List<String> T1_ORDER = List.of(
            "GROUPE_RH", "RAI", "SERO_SYPH", "SERO_HIV",
            "SERO_RUB", "SERO_TOXO", "SERO_HEPB", "GLY",
            "BU_ECBU", "ECBU"
    );

    private static final Map<String, String> T2_PANEL = Map.of(
            "NFS",       "Numération Formule Sanguine (NFS)",
            "SERO_TOXO", "Sérologie toxoplasmose de contrôle (si négative en T1)",
            "HGPO",      "Hyperglycémie provoquée par voie orale 75 g (HGPO — SA 24-28)"
    );
    private static final List<String> T2_ORDER = List.of("NFS", "SERO_TOXO", "HGPO");

    private static final Map<String, String> T3_PANEL = Map.of(
            "NFS",          "Numération Formule Sanguine (NFS)",
            "RAI",          "RAI de contrôle (si Rh négatif)",
            "STREPTO_B",    "Prélèvement vaginal — Streptocoque B (SA 35-37)",
            "SERO_RECAP",   "Sérologies à recontrôler si négatives (rubéole, toxoplasmose)"
    );
    private static final List<String> T3_ORDER = List.of("NFS", "RAI", "STREPTO_B", "SERO_RECAP");

    // BU and ECBU are in T1 panel but not in the map above (no catalog code) — handled inline
    private static final String BU_LABEL    = "Bandelette urinaire (BU)";
    private static final String ECBU_LABEL  = "Examen cytobactériologique des urines (ECBU si BU+)";

    private final PregnancyRepository pregnancyRepo;
    private final JdbcTemplate jdbc;

    public PregnancyBioPanelServiceImpl(PregnancyRepository pregnancyRepo, JdbcTemplate jdbc) {
        this.pregnancyRepo = pregnancyRepo;
        this.jdbc = jdbc;
    }

    @Override
    public BioPanelTemplate buildTemplate(UUID pregnancyId, String trimester, UUID actorId) {
        // Guard: pregnancy must exist
        pregnancyRepo.findById(pregnancyId)
                .orElseThrow(() -> new NotFoundException("PREGNANCY_NOT_FOUND",
                        "Grossesse introuvable: " + pregnancyId));

        // Guard: valid trimester
        if (trimester == null || !VALID_TRIMESTERS.contains(trimester.toUpperCase())) {
            throw new BusinessException("INVALID_TRIMESTER",
                    "Trimestre invalide : attendu T1, T2 ou T3, reçu : " + trimester, 422);
        }

        String t = trimester.toUpperCase();
        List<BioPanelLine> lines = switch (t) {
            case "T1" -> buildT1Lines();
            case "T2" -> buildT2Lines();
            case "T3" -> buildT3Lines();
            default   -> List.of(); // unreachable — guarded above
        };

        return new BioPanelTemplate(pregnancyId, t, lines);
    }

    // ─────────────────────────────────────────────────────────────────────────

    private List<BioPanelLine> buildT1Lines() {
        List<BioPanelLine> lines = new ArrayList<>();
        // Catalog-lookable tests
        for (String code : List.of("GROUPE_RH", "RAI", "SERO_SYPH", "SERO_HIV",
                "SERO_RUB", "SERO_TOXO", "SERO_HEPB", "GLY")) {
            String label = T1_PANEL.get(code);
            lines.add(resolveTest(code, label));
        }
        // BU — look up by code (no dedicated constant key)
        lines.add(resolveTestWithFallback("BU", BU_LABEL));
        // ECBU — look up by code
        lines.add(resolveTestWithFallback("ECBU", ECBU_LABEL));
        return lines;
    }

    private List<BioPanelLine> buildT2Lines() {
        List<BioPanelLine> lines = new ArrayList<>();
        for (String code : T2_ORDER) {
            String label = T2_PANEL.get(code);
            lines.add(resolveTest(code, label));
        }
        return lines;
    }

    private List<BioPanelLine> buildT3Lines() {
        List<BioPanelLine> lines = new ArrayList<>();
        for (String code : T3_ORDER) {
            String label = T3_PANEL.get(code);
            lines.add(resolveTest(code, label));
        }
        return lines;
    }

    /**
     * Looks up a catalog code. If found in catalog_lab_test, uses the catalog label.
     * If not found, falls back to the hardcoded label with catalogCode = null.
     */
    private BioPanelLine resolveTest(String code, String fallbackLabel) {
        String catalogCode = lookupCatalogCode(code);
        if (catalogCode != null) {
            String catalogLabel = lookupCatalogLabel(code);
            return new BioPanelLine(catalogCode, catalogLabel, null);
        }
        return new BioPanelLine(null, fallbackLabel, fallbackLabel);
    }

    private BioPanelLine resolveTestWithFallback(String code, String fallbackLabel) {
        return resolveTest(code, fallbackLabel);
    }

    private String lookupCatalogCode(String code) {
        try {
            List<String> result = jdbc.queryForList(
                    "SELECT code FROM catalog_lab_test WHERE code = ? AND active = TRUE",
                    String.class, code);
            return result.isEmpty() ? null : result.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private String lookupCatalogLabel(String code) {
        try {
            List<String> result = jdbc.queryForList(
                    "SELECT name FROM catalog_lab_test WHERE code = ? AND active = TRUE",
                    String.class, code);
            return result.isEmpty() ? code : result.get(0);
        } catch (Exception e) {
            return code;
        }
    }
}
