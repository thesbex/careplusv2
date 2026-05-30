package ma.careplus.configuration.infrastructure.web;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import javax.sql.DataSource;
import ma.careplus.shared.error.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sauvegarde / restauration de la base — écran d'administration réservé au
 * SUPER_ADMIN (cf. V069). On-premise : les sauvegardes (.dump pg_dump format
 * custom) sont produites par {@code scripts/backup/careplus-backup.ps1} vers le
 * disque configuré ({@code careplus.backup.dir}).
 *
 * <ul>
 *   <li>GET  /api/admin/backups          — liste les sauvegardes disponibles.</li>
 *   <li>POST /api/admin/backups/restore  — restaure la base depuis un .dump.</li>
 * </ul>
 *
 * <p><b>Sécurité.</b> Réservé SUPER_ADMIN. Le nom de fichier est strictement
 * validé (un seul segment, suffixe {@code .dump}, présence vérifiée dans le
 * dossier de sauvegarde) pour interdire toute traversée de chemin.
 *
 * <p><b>Restauration = opération DESTRUCTIVE.</b> {@code pg_restore --clean}
 * remplace le contenu de la base. L'IHM impose une double confirmation et
 * recommande un redémarrage applicatif ensuite. Le script CLI reste le moyen de
 * secours quand l'application ne démarre plus (cf. scripts/backup/README.md).
 */
@RestController
@RequestMapping("/api/admin/backups")
@Tag(name = "backup", description = "Sauvegarde / restauration BDD (super admin)")
public class BackupController {

    private static final Logger log = LoggerFactory.getLogger(BackupController.class);

    private final String backupDir;
    private final String pgRestoreBin;
    private final DataSource dataSource;

    // Les coordonnées de connexion sont lues depuis la DataSource (toujours
    // présente, y compris sous Testcontainers @ServiceConnection) plutôt que des
    // propriétés spring.datasource.* — celles-ci ne sont pas résolvables comme
    // placeholders quand la datasource est configurée dynamiquement (tests).
    public BackupController(
            @Value("${careplus.backup.dir:./data/backups}") String backupDir,
            @Value("${careplus.backup.pg-restore-bin:pg_restore}") String pgRestoreBin,
            DataSource dataSource) {
        this.backupDir = backupDir;
        this.pgRestoreBin = pgRestoreBin;
        this.dataSource = dataSource;
    }

    public record BackupFileView(String name, long sizeBytes, OffsetDateTime modifiedAt) {}

    public record RestoreRequest(@NotBlank String fileName) {}

    public record RestoreResponse(String message, String fileName) {}

    /** Liste les sauvegardes (.dump) présentes, plus récentes d'abord. */
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<BackupFileView> list() {
        Path dir = Path.of(backupDir);
        if (!Files.isDirectory(dir)) {
            // Dossier non encore créé (aucune sauvegarde) → liste vide, pas une erreur.
            return List.of();
        }
        List<BackupFileView> out = new ArrayList<>();
        try (var stream = Files.list(dir)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".dump"))
                    .forEach(p -> {
                        try {
                            out.add(new BackupFileView(
                                    p.getFileName().toString(),
                                    Files.size(p),
                                    OffsetDateTime.ofInstant(
                                            Files.getLastModifiedTime(p).toInstant(),
                                            ZoneId.systemDefault())));
                        } catch (IOException e) {
                            log.warn("Lecture métadonnées sauvegarde {} : {}", p, e.getMessage());
                        }
                    });
        } catch (IOException e) {
            throw new BusinessException("BACKUP_DIR_UNREADABLE",
                    "Impossible de lire le dossier de sauvegarde.",
                    HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
        out.sort(Comparator.comparing(BackupFileView::modifiedAt).reversed());
        return out;
    }

    /**
     * Restaure la base depuis une sauvegarde. DESTRUCTIF. SUPER_ADMIN seul.
     * Valide le nom de fichier (anti-traversée), exécute pg_restore --clean
     * --if-exists, puis recommande un redémarrage applicatif.
     */
    @PostMapping("/restore")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<RestoreResponse> restore(@Valid @RequestBody RestoreRequest req) {
        Path file = resolveAndValidate(req.fileName());

        DbCoords db = readDbCoords();
        JdbcConn conn = parseJdbc(db.url());
        ProcessBuilder pb = new ProcessBuilder(
                pgRestoreBin,
                "-h", conn.host(),
                "-p", String.valueOf(conn.port()),
                "-U", db.user(),
                "-d", conn.database(),
                "--clean", "--if-exists", "--no-owner",
                file.toString());
        if (db.password() != null) {
            pb.environment().put("PGPASSWORD", db.password());
        }
        pb.redirectErrorStream(true);

        try {
            Process p = pb.start();
            String output = new String(p.getInputStream().readAllBytes());
            int code = p.waitFor();
            if (code != 0) {
                log.error("Restauration échouée (code {}) depuis {} : {}",
                        code, file.getFileName(), output);
                throw new BusinessException("RESTORE_FAILED",
                        "La restauration a échoué (code " + code + "). "
                                + "Consultez les journaux serveur.",
                        HttpStatus.INTERNAL_SERVER_ERROR.value());
            }
            log.warn("Base restaurée depuis {} par un super administrateur. "
                    + "Un redémarrage de l'application est recommandé.", file.getFileName());
            return ResponseEntity.ok(new RestoreResponse(
                    "Restauration terminée. Redémarrez l'application pour garantir un état cohérent.",
                    file.getFileName().toString()));
        } catch (IOException e) {
            // pg_restore introuvable / non exécutable.
            throw new BusinessException("RESTORE_PG_RESTORE_MISSING",
                    "pg_restore introuvable sur le serveur (configurez careplus.backup.pg-restore-bin).",
                    HttpStatus.INTERNAL_SERVER_ERROR.value());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("RESTORE_INTERRUPTED",
                    "Restauration interrompue.", HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
    }

    /**
     * Valide que {@code fileName} est un simple nom de fichier .dump présent dans
     * le dossier de sauvegarde — aucune traversée de chemin ({@code ..}, séparateurs).
     */
    private Path resolveAndValidate(String fileName) {
        if (fileName.contains("/") || fileName.contains("\\") || fileName.contains("..")
                || !fileName.endsWith(".dump")) {
            throw new BusinessException("INVALID_BACKUP_NAME",
                    "Nom de sauvegarde invalide.", HttpStatus.BAD_REQUEST.value());
        }
        Path dir = Path.of(backupDir).toAbsolutePath().normalize();
        Path resolved = dir.resolve(fileName).normalize();
        if (!resolved.startsWith(dir) || !Files.isRegularFile(resolved)) {
            throw new BusinessException("BACKUP_NOT_FOUND",
                    "Sauvegarde introuvable : " + fileName, HttpStatus.NOT_FOUND.value());
        }
        return resolved;
    }

    private record JdbcConn(String host, int port, String database) {}

    private record DbCoords(String url, String user, String password) {}

    /**
     * Lit les coordonnées de connexion. Privilégie HikariDataSource (défaut Spring
     * Boot, expose url/user/password — couvre prod ET Testcontainers). À défaut,
     * retombe sur les métadonnées de connexion (url + user ; password absent).
     */
    private DbCoords readDbCoords() {
        if (dataSource instanceof com.zaxxer.hikari.HikariDataSource hikari) {
            return new DbCoords(hikari.getJdbcUrl(), hikari.getUsername(), hikari.getPassword());
        }
        try (var c = dataSource.getConnection()) {
            return new DbCoords(c.getMetaData().getURL(), c.getMetaData().getUserName(), null);
        } catch (java.sql.SQLException e) {
            throw new BusinessException("DATASOURCE_UNAVAILABLE",
                    "Impossible de lire les coordonnées de la base.",
                    HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
    }

    /** Extrait host/port/db d'une URL jdbc:postgresql://host:port/db. */
    private static JdbcConn parseJdbc(String url) {
        try {
            String s = url.substring("jdbc:postgresql://".length());
            String hostPort = s.substring(0, s.indexOf('/'));
            String db = s.substring(s.indexOf('/') + 1);
            if (db.contains("?")) db = db.substring(0, db.indexOf('?'));
            String host = hostPort.contains(":") ? hostPort.substring(0, hostPort.indexOf(':')) : hostPort;
            int port = hostPort.contains(":")
                    ? Integer.parseInt(hostPort.substring(hostPort.indexOf(':') + 1))
                    : 5432;
            return new JdbcConn(host, port, db);
        } catch (RuntimeException e) {
            throw new BusinessException("DATASOURCE_PARSE",
                    "URL de base de données illisible.", HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
    }
}
