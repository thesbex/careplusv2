package ma.careplus.documents.application;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;

/**
 * Stockage filesystem des documents patient (QA2-2).
 *
 * Le binaire vit sous {@code careplus.documents.root/<patient-id>/<doc-id>.<ext>}.
 * Pourquoi filesystem et pas un blob storage cloud ? Le déploiement
 * cible est on-premise (cabinet médical, ADR-020). Le backup OVH passera
 * par le job batch qui zippera ce répertoire — pas besoin de SDK S3 dans
 * le hot path.
 *
 * Le chemin {@code root} est résolu dans l'ordre :
 *   1. propriété {@code careplus.documents.root}
 *   2. fallback {@code java.io.tmpdir}/careplus-documents (utile pour les ITs)
 */
@Component
public class DocumentStorage {

    private static final Logger log = LoggerFactory.getLogger(DocumentStorage.class);

    private final Path root;

    public DocumentStorage(@Value("${careplus.documents.root:#{null}}") String configuredRoot)
            throws IOException {
        Path resolved = (configuredRoot != null && !configuredRoot.isBlank())
                ? Paths.get(configuredRoot)
                : Paths.get(System.getProperty("java.io.tmpdir"), "careplus-documents");
        Files.createDirectories(resolved);
        this.root = resolved.toAbsolutePath().normalize();
        log.info("Document storage root: {}", this.root);
    }

    /** Écrit le flux donné et retourne la clé relative (sans slash de tête). */
    public String store(UUID patientId, UUID documentId, String extension, InputStream content)
            throws IOException {
        String safeExt = sanitizeExtension(extension);
        String key = patientId.toString() + "/" + documentId.toString()
                + (safeExt.isEmpty() ? "" : "." + safeExt);
        Path target = resolve(key);
        Files.createDirectories(target.getParent());
        Files.copy(content, target, StandardCopyOption.REPLACE_EXISTING);
        return key;
    }

    public Resource loadAsResource(String storageKey) {
        return new FileSystemResource(resolve(storageKey));
    }

    public boolean exists(String storageKey) {
        return Files.exists(resolve(storageKey));
    }

    public void delete(String storageKey) throws IOException {
        Path target = resolve(storageKey);
        Files.deleteIfExists(target);
    }

    /** Résout la clé en chemin absolu en garantissant qu'on reste sous {@code root}. */
    private Path resolve(String storageKey) {
        Path candidate = root.resolve(storageKey).normalize();
        if (!candidate.startsWith(root)) {
            throw new IllegalArgumentException("storageKey traverses root: " + storageKey);
        }
        return candidate;
    }

    private static String sanitizeExtension(String ext) {
        if (ext == null) return "";
        String trimmed = ext.trim().toLowerCase();
        if (trimmed.startsWith(".")) trimmed = trimmed.substring(1);
        return trimmed.replaceAll("[^a-z0-9]", "");
    }
}
