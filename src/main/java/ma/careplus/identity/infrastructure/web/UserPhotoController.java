package ma.careplus.identity.infrastructure.web;

import java.util.Map;
import java.util.UUID;
import ma.careplus.identity.application.UserPhotoService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * Endpoints photo de profil utilisateur (V052).
 *
 *   PUT    /api/me/photo               multipart : file                    → upload / remplace
 *   DELETE /api/me/photo                                                   → retire
 *   GET    /api/users/{id}/photo                                           → renvoie le binaire
 *
 * Sécurité :
 *   - PUT / DELETE → user authentifié (n'agit que sur lui-même).
 *   - GET /users/{id}/photo → tout user authentifié (les avatars sont
 *     visibles dans le chat / la team listing, donc accessibles à tous).
 */
@RestController
public class UserPhotoController {

    private final UserPhotoService service;

    public UserPhotoController(UserPhotoService service) {
        this.service = service;
    }

    @PutMapping(value = "/api/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> uploadOwn(
            @RequestParam("file") MultipartFile file,
            Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        UserPhotoService.PhotoMeta meta = service.upload(userId, file);
        return ResponseEntity.ok(Map.of(
                "userId", meta.userId(),
                "mime", meta.mime(),
                "sizeBytes", meta.sizeBytes(),
                "uploadedAt", meta.uploadedAt().toString()));
    }

    @DeleteMapping("/api/me/photo")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> deleteOwn(Authentication auth) {
        UUID userId = UUID.fromString(auth.getName());
        service.delete(userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/users/{id}/photo")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> get(@PathVariable UUID id) {
        UserPhotoService.LoadedPhoto loaded = service.load(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, loaded.mime())
                .header(HttpHeaders.CACHE_CONTROL, "private, max-age=60")
                .body(loaded.bytes());
    }
}
