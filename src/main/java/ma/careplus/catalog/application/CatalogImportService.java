package ma.careplus.catalog.application;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.text.Normalizer;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Catalog CSV import — admin upload pour ajouter / mettre à jour des
 * médicaments, analyses ou examens d'imagerie qui n'existent pas encore
 * dans le catalogue (rapport Y. Boutaleb 2026-05-01).
 *
 * Format CSV
 * ----------
 *   - UTF-8 obligatoire (les noms commerciaux contiennent des caractères
 *     accentués). En-tête sur la 1re ligne.
 *   - Séparateur auto-détecté entre `,` et `;` (Excel FR sort `;` par défaut).
 *     Champs entourés de guillemets doubles si la valeur contient le séparateur
 *     ou un saut de ligne. `""` = guillemet littéral.
 *   - Noms de colonnes insensibles à la casse + accents + alias FR :
 *     `nom`/`name`, `categorie`/`category`, `modalite`/`modality`, etc.
 *
 * Stratégie d'upsert
 * ------------------
 *   - LAB    : clé naturelle = `code` (UNIQUE en DB) → INSERT ... ON CONFLICT.
 *   - RADIO  : clé naturelle = `code` (UNIQUE en DB) → INSERT ... ON CONFLICT.
 *   - DRUG   : pas de clé unique naturelle → match (commercial_name, dci, form, dosage).
 *              Si trouvé → UPDATE atc_code/tags/active. Sinon INSERT.
 *
 * Format de retour : {@link ImportResult} = compteurs + erreurs ligne-par-ligne,
 * pour que l'UI puisse afficher un résumé clair après un upload.
 *
 * Note : les XLSX sont volontairement hors scope (pas d'Apache POI au pom).
 * On documente le format CSV requis dans la modale d'upload.
 */
@Service
public class CatalogImportService {

    private final JdbcTemplate jdbc;

    public CatalogImportService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Compteurs renvoyés à l'UI. */
    public record ImportResult(
            int added,
            int updated,
            int skipped,
            List<String> errors
    ) {}

    // ── Public API ──────────────────────────────────────────────────────────

    @Transactional
    public ImportResult importMedications(MultipartFile file) {
        return importCsv(file, this::upsertMedicationRow,
                List.of("commercial_name", "dci", "form", "dosage"));
    }

    @Transactional
    public ImportResult importLabTests(MultipartFile file) {
        return importCsv(file, this::upsertLabTestRow,
                List.of("code", "name"));
    }

    @Transactional
    public ImportResult importImagingExams(MultipartFile file) {
        return importCsv(file, this::upsertImagingExamRow,
                List.of("code", "name"));
    }

    // ── Per-row upserts (return a verb tag for the counter) ────────────────

    private static final String ADDED = "ADDED";
    private static final String UPDATED = "UPDATED";

    private String upsertMedicationRow(Map<String, String> r) {
        String name = required(r, "commercial_name");
        String dci  = required(r, "dci");
        String form = required(r, "form");
        String dose = required(r, "dosage");
        String atc  = optional(r, "atc_code");
        String tags = optional(r, "tags");
        boolean active = parseBool(r.get("active"), true);

        // No DB UNIQUE constraint on the natural key, so we look up first.
        List<UUID> existing = jdbc.queryForList(
                "SELECT id FROM catalog_medication "
                + "WHERE commercial_name = ? AND dci = ? AND form = ? AND dosage = ?",
                UUID.class, name, dci, form, dose);
        if (!existing.isEmpty()) {
            jdbc.update(
                    "UPDATE catalog_medication "
                    + "SET atc_code = ?, tags = ?, active = ?, updated_at = now() WHERE id = ?",
                    atc, tags, active, existing.get(0));
            return UPDATED;
        }
        jdbc.update(
                "INSERT INTO catalog_medication "
                + "(id, commercial_name, dci, form, dosage, atc_code, tags, favorite, active) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, ?)",
                UUID.randomUUID(), name, dci, form, dose, atc, tags, active);
        return ADDED;
    }

    private String upsertLabTestRow(Map<String, String> r) {
        String code = required(r, "code");
        String name = required(r, "name");
        String cat  = optional(r, "category");
        boolean active = parseBool(r.get("active"), true);

        int updated = jdbc.update(
                "UPDATE catalog_lab_test "
                + "SET name = ?, category = ?, active = ?, updated_at = now() WHERE code = ?",
                name, cat, active, code);
        if (updated > 0) return UPDATED;

        // ON CONFLICT cible désormais le partial unique index (V021) — predicate
        // explicite sinon Postgres ne peut pas inférer l'index sur lequel arbitrer.
        jdbc.update(
                "INSERT INTO catalog_lab_test (id, code, name, category, active) "
                + "VALUES (?, ?, ?, ?, ?) "
                + "ON CONFLICT (code) WHERE active = TRUE DO UPDATE SET "
                + "  name = EXCLUDED.name, category = EXCLUDED.category, "
                + "  active = EXCLUDED.active, updated_at = now()",
                UUID.randomUUID(), code, name, cat, active);
        return ADDED;
    }

    private String upsertImagingExamRow(Map<String, String> r) {
        String code = required(r, "code");
        String name = required(r, "name");
        String mod  = optional(r, "modality");
        boolean active = parseBool(r.get("active"), true);

        int updated = jdbc.update(
                "UPDATE catalog_imaging_exam "
                + "SET name = ?, modality = ?, active = ?, updated_at = now() WHERE code = ?",
                name, mod, active, code);
        if (updated > 0) return UPDATED;

        jdbc.update(
                "INSERT INTO catalog_imaging_exam (id, code, name, modality, active) "
                + "VALUES (?, ?, ?, ?, ?) "
                + "ON CONFLICT (code) WHERE active = TRUE DO UPDATE SET "
                + "  name = EXCLUDED.name, modality = EXCLUDED.modality, "
                + "  active = EXCLUDED.active, updated_at = now()",
                UUID.randomUUID(), code, name, mod, active);
        return ADDED;
    }

    // ── CSV parsing + driver ────────────────────────────────────────────────

    /**
     * Parses {@code file} as CSV (UTF-8, header row, comma-separated, RFC4180
     * quoting) and feeds each row to {@code rowFn}. Errors are accumulated —
     * one bad line does not abort the whole import.
     */
    private ImportResult importCsv(
            MultipartFile file,
            java.util.function.Function<Map<String, String>, String> rowFn,
            List<String> requiredCols) {

        if (file == null || file.isEmpty()) {
            throw new BusinessException(
                    "IMPORT_FILE_EMPTY", "Fichier vide.", HttpStatus.BAD_REQUEST.value());
        }
        if (file.getSize() > 5_000_000) {
            throw new BusinessException(
                    "IMPORT_FILE_TOO_LARGE",
                    "Fichier trop volumineux (max 5 Mo).",
                    HttpStatus.BAD_REQUEST.value());
        }

        int added = 0;
        int updated = 0;
        int skipped = 0;
        List<String> errors = new ArrayList<>();

        try (Reader reader = new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8);
             BufferedReader br = new BufferedReader(reader)) {

            // Auto-détection du séparateur : on lit la 1re ligne brute, et on
            // choisit le caractère le plus fréquent entre ',' et ';'. Excel FR
            // sort `;` par défaut, Excel EN/Google Sheets sortent `,`.
            br.mark(8192);
            String firstLine = br.readLine();
            if (firstLine == null) {
                throw new BusinessException(
                        "IMPORT_NO_HEADER", "Fichier CSV sans en-tête.",
                        HttpStatus.BAD_REQUEST.value());
            }
            char sep = detectSeparator(firstLine);
            br.reset();

            List<String> header = parseLine(br, sep);
            if (header == null) {
                throw new BusinessException(
                        "IMPORT_NO_HEADER", "Fichier CSV sans en-tête.",
                        HttpStatus.BAD_REQUEST.value());
            }
            // Normalise header → lower-case + sans accents + alias FR canonisés.
            List<String> norm = header.stream().map(CatalogImportService::normalizeHeader).toList();

            for (String col : requiredCols) {
                if (!norm.contains(col)) {
                    throw new BusinessException(
                            "IMPORT_MISSING_COLUMN",
                            "Colonne obligatoire manquante : " + col
                                    + ". Colonnes lues : " + String.join(", ", header)
                                    + " (séparateur détecté : '" + sep + "').",
                            HttpStatus.BAD_REQUEST.value());
                }
            }

            int line = 1; // header already consumed
            List<String> values;
            while ((values = parseLine(br, sep)) != null) {
                line++;
                if (values.isEmpty() || (values.size() == 1 && values.get(0).isBlank())) {
                    continue; // blank line — silently skip
                }
                Map<String, String> row = new LinkedHashMap<>();
                for (int i = 0; i < norm.size() && i < values.size(); i++) {
                    row.put(norm.get(i), values.get(i));
                }
                try {
                    String verb = rowFn.apply(row);
                    if (ADDED.equals(verb)) added++;
                    else if (UPDATED.equals(verb)) updated++;
                    else skipped++;
                } catch (BusinessException be) {
                    skipped++;
                    errors.add("Ligne " + line + " : " + be.getMessage());
                } catch (Exception e) {
                    skipped++;
                    errors.add("Ligne " + line + " : " + e.getMessage());
                }
            }
        } catch (IOException e) {
            throw new BusinessException(
                    "IMPORT_READ_FAILED",
                    "Lecture du fichier impossible : " + e.getMessage(),
                    HttpStatus.BAD_REQUEST.value());
        }
        return new ImportResult(added, updated, skipped, errors);
    }

    /** Tiny RFC4180-lite parser. Returns null at EOF. */
    private static List<String> parseLine(BufferedReader br, char sep) throws IOException {
        StringBuilder field = new StringBuilder();
        List<String> out = new ArrayList<>();
        boolean inQuotes = false;
        boolean sawAnything = false;
        int c;
        while ((c = br.read()) != -1) {
            sawAnything = true;
            char ch = (char) c;
            if (inQuotes) {
                if (ch == '"') {
                    int next = br.read();
                    if (next == '"') {
                        field.append('"'); // escaped quote
                    } else {
                        inQuotes = false;
                        if (next == -1) break;
                        if (next == sep) { out.add(field.toString()); field.setLength(0); }
                        else if (next == '\n') { out.add(field.toString()); return out; }
                        else if (next == '\r') {
                            out.add(field.toString()); field.setLength(0);
                            int peek = br.read();
                            if (peek != '\n' && peek != -1) {
                                // un-read by buffering — push char into field for next iteration
                                field.append((char) peek);
                            }
                            return out;
                        } else {
                            field.append((char) next);
                        }
                    }
                } else {
                    field.append(ch);
                }
                continue;
            }
            if (ch == '"' && field.length() == 0) {
                inQuotes = true;
            } else if (ch == sep) {
                out.add(field.toString()); field.setLength(0);
            } else if (ch == '\n') {
                out.add(field.toString()); return out;
            } else if (ch == '\r') {
                // optional \r\n — peek for \n
                int peek = br.read();
                if (peek != '\n' && peek != -1) {
                    out.add(field.toString()); field.setLength(0);
                    field.append((char) peek);
                } else {
                    out.add(field.toString()); return out;
                }
            } else {
                field.append(ch);
            }
        }
        if (!sawAnything) return null;
        out.add(field.toString());
        return out;
    }

    /**
     * Choisit `;` si la 1re ligne en contient au moins un ET plus que de `,`.
     * Sinon `,` (défaut RFC4180). Les `;` à l'intérieur de guillemets sont
     * rares en pratique sur la 1re ligne d'entête, on accepte le bruit.
     */
    static char detectSeparator(String firstLine) {
        int commas = 0;
        int semis  = 0;
        boolean inQuotes = false;
        for (int i = 0; i < firstLine.length(); i++) {
            char ch = firstLine.charAt(i);
            if (ch == '"') { inQuotes = !inQuotes; continue; }
            if (inQuotes) continue;
            if (ch == ',') commas++;
            else if (ch == ';') semis++;
        }
        return (semis > 0 && semis >= commas) ? ';' : ',';
    }

    /**
     * Strip accents, lower-case, trim — puis applique des alias FR pour les
     * colonnes que les utilisateurs marocains tapent naturellement en
     * français ("nom" pour "name", "categorie" pour "category", etc.).
     * Idempotent : un nom déjà canonique reste tel quel.
     */
    static String normalizeHeader(String raw) {
        if (raw == null) return "";
        String s = Normalizer.normalize(raw.trim(), Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "")
                .toLowerCase();
        return switch (s) {
            case "nom"               -> "name";
            case "categorie"         -> "category";
            case "modalite"          -> "modality";
            case "actif"             -> "active";
            case "nom commercial"    -> "commercial_name";
            case "forme"             -> "form";
            case "atc"               -> "atc_code";
            default -> s;
        };
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private static String required(Map<String, String> r, String key) {
        String v = r.get(key);
        if (v == null || v.isBlank()) {
            throw new BusinessException(
                    "IMPORT_MISSING_FIELD",
                    "Champ obligatoire vide : " + key,
                    HttpStatus.BAD_REQUEST.value());
        }
        return v.trim();
    }

    private static String optional(Map<String, String> r, String key) {
        String v = r.get(key);
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t;
    }

    private static boolean parseBool(String s, boolean fallback) {
        if (s == null) return fallback;
        String t = s.trim().toLowerCase();
        if (t.isEmpty()) return fallback;
        return !(t.equals("0") || t.equals("false") || t.equals("non") || t.equals("no"));
    }
}
