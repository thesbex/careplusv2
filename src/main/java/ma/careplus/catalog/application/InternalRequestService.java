package ma.careplus.catalog.application;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import ma.careplus.catalog.domain.PrescriptionLine;
import ma.careplus.catalog.infrastructure.persistence.PrescriptionLineRepository;
import ma.careplus.shared.error.BusinessException;
import ma.careplus.shared.error.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * V038 — workflow demandes internes (LAB / IMAGING).
 *
 * State machine (cf. design doc 2026-05-09) :
 * <pre>
 *   NULL ──(médecin coche "Réaliser en interne")──► PENDING
 *   PENDING ──(technicien claim)──► IN_PROGRESS
 *   IN_PROGRESS ──(upload résultat)──► DONE
 *   PENDING|IN_PROGRESS ──(médecin annule)──► CANCELLED
 * </pre>
 *
 * <p>Le service détermine si une ligne relève du service LAB ou RADIO via les
 * FK {@code lab_test_id} / {@code imaging_exam_id} sur la ligne. Pas de doublon
 * de référence.
 *
 * <p>L'auto-attachement résultat → consultation est déjà couvert par V015
 * ({@code clinical_prescription_line.result_document_id}). On se contente
 * de transitionner le statut quand le résultat est uploadé via le mécanisme
 * existant ({@link ma.careplus.documents.application.PrescriptionResultService}).
 */
@Service
@Transactional
public class InternalRequestService {

    public enum Service { LAB, RADIO }

    private final PrescriptionLineRepository lineRepository;
    private final JdbcTemplate jdbc;

    public InternalRequestService(PrescriptionLineRepository lineRepository, JdbcTemplate jdbc) {
        this.lineRepository = lineRepository;
        this.jdbc = jdbc;
    }

    /**
     * Liste les demandes du service donné, filtrées par statut. Les "Traitées"
     * sont implicitement les DONE — l'historique reste consultable mais
     * n'apparaît plus en queue active.
     */
    @Transactional(readOnly = true)
    public List<PrescriptionLine> listByServiceAndStatus(Service service, String status) {
        List<PrescriptionLine> all = lineRepository
                .findByInternalStatusOrderByInternalAssignedAtAsc(status);
        return all.stream().filter(l -> matchesService(l, service)).toList();
    }

    /**
     * Lit le service ciblé par une ligne sans la modifier. Utilisé par le
     * controller pour faire le contrôle de rôle AVANT d'appeler {@link #claim}
     * (sinon la transaction de claim commit déjà la transition même quand le
     * controller veut renvoyer 403). Renvoie {@code null} si la ligne ne
     * référence ni un labTest ni un imagingExam.
     */
    @Transactional(readOnly = true)
    public Service peekService(UUID lineId) {
        PrescriptionLine line = loadOrThrow(lineId);
        return serviceOf(line);
    }

    /**
     * Transition PENDING → IN_PROGRESS. Le technicien doit avoir le rôle
     * correspondant au service de la ligne (vérifié plus haut côté
     * controller). Échoue si la demande a déjà été claim, annulée, ou n'est
     * pas une demande interne du tout.
     */
    public PrescriptionLine claim(UUID lineId, UUID claimerId) {
        PrescriptionLine line = loadOrThrow(lineId);
        if (!"PENDING".equals(line.getInternalStatus())) {
            throw new BusinessException(
                    "INT-INVALID-STATE",
                    "Cette demande n'est plus en attente.",
                    HttpStatus.CONFLICT.value());
        }
        line.setInternalStatus("IN_PROGRESS");
        line.setInternalClaimedBy(claimerId);
        return lineRepository.save(line);
    }

    /**
     * Transition * → CANCELLED. Réservé au médecin/admin. Idempotent si la
     * ligne est déjà CANCELLED ou DONE — on lève quand même une erreur pour
     * éviter une annulation rétroactive d'une demande déjà traitée.
     */
    public PrescriptionLine cancel(UUID lineId) {
        PrescriptionLine line = loadOrThrow(lineId);
        String current = line.getInternalStatus();
        if (current == null) {
            throw new BusinessException(
                    "INT-NOT-INTERNAL",
                    "Cette ligne n'est pas une demande interne.",
                    HttpStatus.BAD_REQUEST.value());
        }
        if ("DONE".equals(current)) {
            throw new BusinessException(
                    "INT-ALREADY-DONE",
                    "Cette demande a déjà été traitée — annulation impossible.",
                    HttpStatus.CONFLICT.value());
        }
        line.setInternalStatus("CANCELLED");
        return lineRepository.save(line);
    }

    /**
     * Appelé par le mécanisme V015 (PrescriptionResultService) après upload
     * d'un résultat : si la ligne est en IN_PROGRESS, transitionne en DONE.
     * Sinon (ligne externe, déjà DONE, etc.), no-op.
     */
    public void onResultUploaded(UUID lineId) {
        PrescriptionLine line = lineRepository.findById(lineId).orElse(null);
        if (line == null) return;
        if ("IN_PROGRESS".equals(line.getInternalStatus())
                || "PENDING".equals(line.getInternalStatus())) {
            // Permet aussi l'upload direct (sans claim explicite) — utile pour
            // les workflows légers où le technicien upload sans bouton "Prendre".
            line.setInternalStatus("DONE");
            lineRepository.save(line);
        }
    }

    /** Détermine le service ciblé par une ligne (LAB ou RADIO). Null si aucun (ne devrait pas arriver pour des lignes internes). */
    public static Service serviceOf(PrescriptionLine line) {
        if (line.getLabTestId() != null) return Service.LAB;
        if (line.getImagingExamId() != null) return Service.RADIO;
        return null;
    }

    private static boolean matchesService(PrescriptionLine line, Service service) {
        Service s = serviceOf(line);
        return s == service;
    }

    private PrescriptionLine loadOrThrow(UUID lineId) {
        return lineRepository.findById(lineId)
                .orElseThrow(() -> new NotFoundException(
                        "LINE_NOT_FOUND",
                        "Ligne d'ordonnance introuvable : " + lineId));
    }

    /** V038 — utilisé par le controller pour résoudre le nom (LAB ou RADIO) du test. */
    @Transactional(readOnly = true)
    public String fetchTestName(PrescriptionLine line) {
        try {
            if (line.getLabTestId() != null) {
                return jdbc.queryForObject(
                        "SELECT name FROM catalog_lab_test WHERE id = ?",
                        String.class, line.getLabTestId());
            }
            if (line.getImagingExamId() != null) {
                return jdbc.queryForObject(
                        "SELECT name FROM catalog_imaging_exam WHERE id = ?",
                        String.class, line.getImagingExamId());
            }
        } catch (Exception e) {
            return null;
        }
        return null;
    }

    /** V038 — patient + médecin via la consultation de la prescription, pour l'affichage queue. */
    @Transactional(readOnly = true)
    public QueueRowMeta fetchQueueRowMeta(PrescriptionLine line) {
        try {
            return jdbc.queryForObject(
                    "SELECT p.first_name || ' ' || UPPER(p.last_name) AS patient_name, "
                            + "       u.first_name || ' ' || u.last_name AS doctor_name, "
                            + "       pr.id AS prescription_id "
                            + "FROM clinical_prescription pr "
                            + "JOIN clinical_consultation c ON c.id = pr.consultation_id "
                            + "JOIN patient_patient p ON p.id = c.patient_id "
                            + "LEFT JOIN identity_user u ON u.id = c.practitioner_id "
                            + "WHERE pr.id = ?",
                    (rs, i) -> new QueueRowMeta(
                            rs.getString("patient_name"),
                            rs.getString("doctor_name"),
                            (UUID) rs.getObject("prescription_id")),
                    line.getPrescriptionId());
        } catch (Exception e) {
            return new QueueRowMeta(null, null, line.getPrescriptionId());
        }
    }

    public record QueueRowMeta(String patientName, String doctorName, UUID prescriptionId) {}

    /** V038 — horodatage utile pour visualiser la fraîcheur d'une demande. Non-mutant. */
    public static OffsetDateTime claimedOrAssignedAt(PrescriptionLine line) {
        return line.getInternalAssignedAt();
    }
}
