package ma.careplus.identity.application;

import java.io.IOException;
import java.nio.file.Files;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import ma.careplus.documents.application.DocumentStorage;
import ma.careplus.shared.error.BusinessException;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Service photo de profil utilisateur (V052).
 *
 * Le binaire est stocké via {@link DocumentStorage} sous {@code users/<userId>.<ext>}.
 * La méta-donnée (mime / size / uploaded_at + clé) vit directement sur
 * {@code identity_user} — pas de table dédiée, c'est un 1-1 immuable côté
 * cardinalité (une photo courante par user à la fois).
 */
@Service
public class UserPhotoService {

    private static final Set<String> ALLOWED_MIME = Set.of(
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/heic",
            "image/heif"
    );

    private static final long MAX_BYTES = 2L * 1024 * 1024;

    /** Pseudo "patient id" utilisé par DocumentStorage pour préfixer la clé. */
    private static final UUID USERS_NAMESPACE = UUID.fromString("00000000-0000-0000-0000-000000000001");

    private final JdbcTemplate jdbc;
    private final DocumentStorage storage;

    public UserPhotoService(JdbcTemplate jdbc, DocumentStorage storage) {
        this.jdbc = jdbc;
        this.storage = storage;
    }

    public PhotoMeta upload(UUID userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("USER_PHOTO_EMPTY",
                    "Photo vide ou manquante.", HttpStatus.BAD_REQUEST.value());
        }
        String mime = file.getContentType();
        if (mime == null || !ALLOWED_MIME.contains(mime.toLowerCase(Locale.ROOT))) {
            throw new BusinessException("USER_PHOTO_MIME",
                    "Format non supporté. Acceptés : JPEG, PNG, WebP, HEIC.",
                    HttpStatus.UNSUPPORTED_MEDIA_TYPE.value());
        }
        if (file.getSize() > MAX_BYTES) {
            throw new BusinessException("USER_PHOTO_TOO_LARGE",
                    "Photo trop volumineuse (max 2 Mo).",
                    HttpStatus.PAYLOAD_TOO_LARGE.value());
        }
        // Best-effort delete de l'ancien fichier physique avant écrasement.
        Map<String, Object> existing;
        try {
            existing = jdbc.queryForMap(
                    "SELECT photo_storage_key FROM identity_user WHERE id = ?", userId);
        } catch (Exception e) {
            existing = Map.of();
        }
        Object prev = existing.get("photo_storage_key");
        if (prev instanceof String prevKey && !prevKey.isBlank()) {
            try {
                storage.delete(prevKey);
            } catch (IOException ignore) {
                // best-effort, ignore
            }
        }
        String ext = guessExtension(mime);
        String key;
        try {
            key = storage.store(USERS_NAMESPACE, userId, ext, file.getInputStream());
        } catch (IOException e) {
            throw new BusinessException("USER_PHOTO_IO",
                    "Échec de l'écriture du fichier.", HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
        OffsetDateTime now = OffsetDateTime.now();
        jdbc.update("""
                UPDATE identity_user
                   SET photo_storage_key = ?,
                       photo_mime = ?,
                       photo_size_bytes = ?,
                       photo_uploaded_at = ?,
                       updated_at = now()
                 WHERE id = ?
                """,
                key, mime, file.getSize(), now, userId);
        return new PhotoMeta(userId, key, mime, file.getSize(), now);
    }

    public void delete(UUID userId) {
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap(
                    "SELECT photo_storage_key FROM identity_user WHERE id = ?", userId);
        } catch (Exception e) {
            return;
        }
        Object key = row.get("photo_storage_key");
        if (key instanceof String s && !s.isBlank()) {
            try {
                storage.delete(s);
            } catch (IOException ignore) {
                // ignore
            }
        }
        jdbc.update("""
                UPDATE identity_user
                   SET photo_storage_key = NULL,
                       photo_mime = NULL,
                       photo_size_bytes = NULL,
                       photo_uploaded_at = NULL,
                       updated_at = now()
                 WHERE id = ?
                """, userId);
    }

    /** Returns the resource + mime, or throws 404 if no photo. */
    public LoadedPhoto load(UUID userId) {
        Map<String, Object> row;
        try {
            row = jdbc.queryForMap(
                    "SELECT photo_storage_key, photo_mime FROM identity_user WHERE id = ?", userId);
        } catch (Exception e) {
            throw new BusinessException("USER_PHOTO_NOT_FOUND",
                    "Aucune photo.", HttpStatus.NOT_FOUND.value());
        }
        Object key = row.get("photo_storage_key");
        Object mime = row.get("photo_mime");
        if (!(key instanceof String s) || s.isBlank()) {
            throw new BusinessException("USER_PHOTO_NOT_FOUND",
                    "Aucune photo.", HttpStatus.NOT_FOUND.value());
        }
        Resource res = storage.loadAsResource(s);
        try {
            long len = res.exists() ? res.contentLength() : -1L;
            if (len <= 0) {
                throw new BusinessException("USER_PHOTO_FILE_MISSING",
                        "Fichier physique introuvable.", HttpStatus.GONE.value());
            }
            byte[] bytes = Files.readAllBytes(res.getFile().toPath());
            return new LoadedPhoto(bytes, mime instanceof String m ? m : "application/octet-stream");
        } catch (IOException e) {
            throw new BusinessException("USER_PHOTO_IO",
                    "Échec de lecture.", HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
    }

    private static String guessExtension(String mime) {
        return switch (mime.toLowerCase(Locale.ROOT)) {
            case "image/jpeg" -> "jpg";
            case "image/png" -> "png";
            case "image/webp" -> "webp";
            case "image/heic", "image/heif" -> "heic";
            default -> "";
        };
    }

    public record PhotoMeta(UUID userId, String storageKey, String mime, long sizeBytes,
                             OffsetDateTime uploadedAt) {}

    public record LoadedPhoto(byte[] bytes, String mime) {}
}
