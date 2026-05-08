package ma.careplus.identity.infrastructure.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;
import ma.careplus.shared.error.BusinessException;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
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
 * Endpoints de gestion de la signature scannée par utilisateur (V035).
 *
 * <p>Chaque MEDECIN a sa signature stockée sur sa ligne {@code identity_user}.
 * Les ordonnances, certificats et carnets de vaccination injectent la
 * signature du médecin qui a généré le document — pas une signature globale
 * cabinet. Aligné avec la décision multi-praticien du 2026-05-07.
 *
 * <p>Règle d'autorisation : un utilisateur peut éditer/supprimer SA propre
 * signature (UUID dans le JWT == path param). L'ADMIN peut éditer celle de
 * n'importe quel utilisateur (utile pour la première mise en place ou
 * remplacement après onboarding d'un nouveau médecin). La lecture (meta +
 * blob) est ouverte à tous les rôles authentifiés — les PDFs back-end en ont
 * besoin et la pré-vue front est lue par n'importe quel user logged-in.
 */
@RestController
@Tag(name = "identity", description = "User signature endpoints")
public class UserSignatureController {

    /** MIME types autorisés pour la signature scannée (alignés sur SettingsController). */
    private static final Set<String> ALLOWED_MIMES = Set.of("image/png", "image/jpeg", "image/webp");
    /** Limite stricte côté backend, indépendante de la limite multipart globale. */
    private static final long MAX_BYTES = 500L * 1024L; // 500 Ko

    private final JdbcTemplate jdbc;

    public UserSignatureController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record SignatureMetaView(String mime, OffsetDateTime uploadedAt, int sizeBytes) {}

    /**
     * Métadonnées (existence + MIME + date + taille). 204 si pas de signature.
     * Tous rôles auth — le frontend en a besoin pour afficher l'aperçu sans
     * télécharger les bytes tant que c'est pas nécessaire.
     */
    @GetMapping("/api/practitioners/{id}/signature/meta")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(summary = "Métadonnées de la signature d'un utilisateur")
    public ResponseEntity<SignatureMetaView> getMeta(@PathVariable UUID id) {
        try {
            SignatureMetaView v = jdbc.queryForObject(
                    "SELECT signature_mime, signature_uploaded_at, "
                            + "COALESCE(octet_length(signature_blob), 0) AS sz "
                            + "FROM identity_user WHERE id = ?",
                    (rs, i) -> {
                        String mime = rs.getString("signature_mime");
                        if (mime == null) return null;
                        OffsetDateTime ts = rs.getObject("signature_uploaded_at", OffsetDateTime.class);
                        return new SignatureMetaView(mime, ts, rs.getInt("sz"));
                    },
                    id);
            if (v == null) return ResponseEntity.noContent().build();
            return ResponseEntity.ok(v);
        } catch (EmptyResultDataAccessException e) {
            return ResponseEntity.noContent().build();
        }
    }

    /**
     * Bytes bruts de l'image (image/png|jpeg|webp). 204 si non configurée.
     * Tous rôles auth (l'aperçu front utilise cet endpoint).
     */
    @GetMapping("/api/practitioners/{id}/signature")
    @PreAuthorize("hasAnyRole('SECRETAIRE','ASSISTANT','MEDECIN','ADMIN')")
    @Operation(summary = "Image signature scannée d'un utilisateur (bytes bruts)")
    public ResponseEntity<byte[]> get(@PathVariable UUID id) {
        try {
            return jdbc.queryForObject(
                    "SELECT signature_blob, signature_mime FROM identity_user WHERE id = ?",
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
                    },
                    id);
        } catch (EmptyResultDataAccessException e) {
            return ResponseEntity.noContent().build();
        }
    }

    /**
     * Upload (multipart, champ "file"). Self-edit ou ADMIN. Validations :
     *   • MIME ∈ {png, jpeg, webp}
     *   • taille ≤ 500 Ko
     */
    @PutMapping(value = "/api/practitioners/{id}/signature",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Téléverser la signature scannée d'un utilisateur")
    public ResponseEntity<SignatureMetaView> upload(@PathVariable UUID id,
                                                    @RequestParam("file") MultipartFile file,
                                                    Authentication auth) {
        ensureSelfOrAdmin(id, auth);

        if (file == null || file.isEmpty()) {
            throw new BusinessException("SIG-EMPTY", "Fichier vide.", 400);
        }
        String mime = file.getContentType();
        if (mime == null || !ALLOWED_MIMES.contains(mime.toLowerCase())) {
            throw new BusinessException("SIG-MIME",
                    "Format non autorisé. Utiliser PNG, JPEG ou WEBP.", 400);
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BusinessException("SIG-TOO-BIG",
                    "Image trop volumineuse (max 500 Ko).", 400);
        }
        byte[] bytes;
        try {
            bytes = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("SIG-IO", "Lecture du fichier impossible.", 400);
        }
        if (bytes.length > MAX_BYTES) {
            throw new BusinessException("SIG-TOO-BIG",
                    "Image trop volumineuse (max 500 Ko).", 400);
        }

        int updated = jdbc.update(
                "UPDATE identity_user SET signature_blob = ?, signature_mime = ?, "
                        + "signature_uploaded_at = now(), updated_at = now() WHERE id = ?",
                bytes, mime.toLowerCase(), id);
        if (updated == 0) {
            throw new BusinessException("USER_NOT_FOUND",
                    "Utilisateur introuvable : " + id, 404);
        }
        OffsetDateTime ts = jdbc.queryForObject(
                "SELECT signature_uploaded_at FROM identity_user WHERE id = ?",
                OffsetDateTime.class, id);
        return ResponseEntity.ok(new SignatureMetaView(mime.toLowerCase(), ts, bytes.length));
    }

    /** Supprime la signature configurée. Self-edit ou ADMIN. Idempotent. */
    @DeleteMapping("/api/practitioners/{id}/signature")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Supprimer la signature d'un utilisateur")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       Authentication auth) {
        ensureSelfOrAdmin(id, auth);
        jdbc.update(
                "UPDATE identity_user SET signature_blob = NULL, signature_mime = NULL, "
                        + "signature_uploaded_at = NULL, updated_at = now() WHERE id = ?",
                id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Self-edit OU ADMIN. JwtAuthenticationFilter pose le sub JWT (= UUID
     * utilisateur) sur {@code Authentication.getName()}, donc la comparaison
     * UUID est directe.
     */
    private void ensureSelfOrAdmin(UUID targetId, Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (isAdmin) return;

        UUID callerId = parseCallerId(auth);
        if (callerId == null || !callerId.equals(targetId)) {
            throw new BusinessException("FORBIDDEN",
                    "Vous ne pouvez modifier que votre propre signature.", 403);
        }
    }

    private UUID parseCallerId(Authentication auth) {
        String name = auth == null ? null : auth.getName();
        if (name == null) return null;
        try {
            return UUID.fromString(name);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
