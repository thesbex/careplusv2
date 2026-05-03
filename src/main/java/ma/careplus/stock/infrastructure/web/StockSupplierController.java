package ma.careplus.stock.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import ma.careplus.stock.application.StockCatalogService;
import ma.careplus.stock.infrastructure.web.dto.StockSupplierView;
import ma.careplus.stock.infrastructure.web.dto.StockSupplierWriteRequest;
import ma.careplus.stock.infrastructure.web.mapper.StockMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
 * Stock supplier endpoints.
 *
 * GET    /api/stock/suppliers         — tous les rôles authentifiés
 * GET    /api/stock/suppliers/{id}    — tous les rôles authentifiés
 * POST   /api/stock/suppliers         — MEDECIN / ADMIN
 * PUT    /api/stock/suppliers/{id}    — MEDECIN / ADMIN
 * DELETE /api/stock/suppliers/{id}    — MEDECIN / ADMIN (soft: active=false)
 */
@RestController
@RequestMapping("/api/stock/suppliers")
@Tag(name = "stock", description = "Module stock interne — fournisseurs")
public class StockSupplierController {

    private final StockCatalogService catalogService;
    private final StockMapper mapper;

    public StockSupplierController(StockCatalogService catalogService, StockMapper mapper) {
        this.catalogService = catalogService;
        this.mapper = mapper;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public List<StockSupplierView> listSuppliers(
            @RequestParam(defaultValue = "false") boolean includeInactive) {
        return catalogService.listSuppliers(includeInactive).stream()
                .map(mapper::toSupplierView)
                .toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    public ResponseEntity<StockSupplierView> getSupplier(@PathVariable UUID id) {
        return ResponseEntity.ok(mapper.toSupplierView(catalogService.getSupplier(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<StockSupplierView> createSupplier(
            @Valid @RequestBody StockSupplierWriteRequest req) {
        StockSupplierView view = mapper.toSupplierView(catalogService.createSupplier(req));
        return ResponseEntity.created(URI.create("/api/stock/suppliers/" + view.id()))
                .body(view);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<StockSupplierView> updateSupplier(
            @PathVariable UUID id,
            @Valid @RequestBody StockSupplierWriteRequest req) {
        return ResponseEntity.ok(mapper.toSupplierView(catalogService.updateSupplier(id, req)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('MEDECIN','ADMIN')")
    public ResponseEntity<Void> deactivateSupplier(@PathVariable UUID id) {
        catalogService.deactivateSupplier(id);
        return ResponseEntity.noContent().build();
    }
}
