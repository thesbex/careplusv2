package ma.careplus.catalog.infrastructure.web;

import ma.careplus.catalog.application.CatalogImportService;
import ma.careplus.catalog.application.CatalogImportService.ImportResult;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Endpoints d'import CSV catalogue (rapport Y. Boutaleb 2026-05-01) :
 *
 *   POST /api/catalog/medications/import
 *   POST /api/catalog/lab-tests/import
 *   POST /api/catalog/imaging-exams/import
 *
 * Chaque endpoint accepte un upload multipart `file` (CSV UTF-8, header row).
 * Réservé à ADMIN / MEDECIN — V018 ajoute la permission `CATALOG_IMPORT`
 * visible dans la matrice RBAC pour granularité future.
 */
@RestController
public class CatalogImportController {

    private final CatalogImportService service;

    public CatalogImportController(CatalogImportService service) {
        this.service = service;
    }

    @PostMapping(
            value = "/api/catalog/medications/import",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','MEDECIN')")
    public ResponseEntity<ImportResult> importMedications(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(service.importMedications(file));
    }

    @PostMapping(
            value = "/api/catalog/lab-tests/import",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','MEDECIN')")
    public ResponseEntity<ImportResult> importLabTests(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(service.importLabTests(file));
    }

    @PostMapping(
            value = "/api/catalog/imaging-exams/import",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','MEDECIN')")
    public ResponseEntity<ImportResult> importImagingExams(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(service.importImagingExams(file));
    }
}
