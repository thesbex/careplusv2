package ma.careplus.clinical.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.clinical.domain.PrescriptionTemplate;
import ma.careplus.clinical.infrastructure.persistence.PrescriptionTemplateRepository;
import ma.careplus.clinical.infrastructure.web.dto.PrescriptionTemplateView;
import ma.careplus.clinical.infrastructure.web.dto.PrescriptionTemplateWriteRequest;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service métier des modèles de prescription. Toutes les méthodes prennent le
 * {@code practitionerId} en argument explicite — l'autorisation (un médecin
 * ne voit que les siens) est appliquée ici, pas seulement au niveau de la route.
 */
@Service
public class PrescriptionTemplateService {

    private static final TypeReference<List<Map<String, Object>>> LINES_TYPE =
            new TypeReference<>() {};

    private final PrescriptionTemplateRepository repo;
    private final ObjectMapper objectMapper;

    public PrescriptionTemplateService(PrescriptionTemplateRepository repo, ObjectMapper objectMapper) {
        this.repo = repo;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<PrescriptionTemplateView> list(UUID practitionerId, String type) {
        return repo.findActiveByPractitionerAndType(practitionerId, type).stream()
                .map(this::toView)
                .toList();
    }

    @Transactional(readOnly = true)
    public PrescriptionTemplateView get(UUID id, UUID practitionerId) {
        PrescriptionTemplate t = repo.findActiveByIdAndPractitioner(id, practitionerId)
                .orElseThrow(this::notFound);
        return toView(t);
    }

    @Transactional
    public PrescriptionTemplateView create(UUID practitionerId, PrescriptionTemplateWriteRequest req) {
        validateLines(req.type(), req.lines());
        if (repo.existsConflictingName(practitionerId, req.type(), req.name(), null)) {
            throw new BusinessException(
                    "TEMPLATE_NAME_CONFLICT",
                    "Vous avez déjà un modèle de ce type avec ce nom.",
                    HttpStatus.CONFLICT.value());
        }
        PrescriptionTemplate t = new PrescriptionTemplate();
        t.setPractitionerId(practitionerId);
        t.setName(req.name().trim());
        t.setType(req.type());
        t.setLinesJson(serialize(req.lines()));
        return toView(repo.save(t));
    }

    @Transactional
    public PrescriptionTemplateView update(UUID id, UUID practitionerId, PrescriptionTemplateWriteRequest req) {
        validateLines(req.type(), req.lines());
        PrescriptionTemplate t = repo.findActiveByIdAndPractitioner(id, practitionerId)
                .orElseThrow(this::notFound);
        if (repo.existsConflictingName(practitionerId, req.type(), req.name(), id)) {
            throw new BusinessException(
                    "TEMPLATE_NAME_CONFLICT",
                    "Un autre modèle de ce type porte déjà ce nom.",
                    HttpStatus.CONFLICT.value());
        }
        t.setName(req.name().trim());
        t.setType(req.type());
        t.setLinesJson(serialize(req.lines()));
        return toView(repo.save(t));
    }

    @Transactional
    public void delete(UUID id, UUID practitionerId) {
        PrescriptionTemplate t = repo.findActiveByIdAndPractitioner(id, practitionerId)
                .orElseThrow(this::notFound);
        t.setDeletedAt(OffsetDateTime.now());
        repo.save(t);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private void validateLines(String type, List<Map<String, Object>> lines) {
        // L'annotation @NotEmpty/@Size couvre déjà la cardinalité ; ici on
        // vérifie la forme par ligne selon le type. On veut un id catalogue
        // sur chaque ligne ; le reste est optionnel (free-text laissé à la
        // discrétion du médecin).
        String idField = switch (type) {
            case "DRUG" -> "medicationId";
            case "LAB" -> "labTestId";
            case "IMAGING" -> "imagingExamId";
            default -> throw new BusinessException(
                    "TEMPLATE_TYPE_INVALID",
                    "Type de modèle invalide.",
                    HttpStatus.BAD_REQUEST.value());
        };
        for (int i = 0; i < lines.size(); i++) {
            Map<String, Object> line = lines.get(i);
            Object id = line == null ? null : line.get(idField);
            if (!(id instanceof String s) || s.isBlank()) {
                throw new BusinessException(
                        "TEMPLATE_LINE_INVALID",
                        "Ligne " + (i + 1) + " : champ « " + idField + " » manquant.",
                        HttpStatus.BAD_REQUEST.value());
            }
            try {
                UUID.fromString(s);
            } catch (IllegalArgumentException ex) {
                throw new BusinessException(
                        "TEMPLATE_LINE_INVALID",
                        "Ligne " + (i + 1) + " : « " + idField + " » n'est pas un UUID valide.",
                        HttpStatus.BAD_REQUEST.value());
            }
        }
    }

    private String serialize(List<Map<String, Object>> lines) {
        try {
            return objectMapper.writeValueAsString(lines);
        } catch (JsonProcessingException ex) {
            throw new BusinessException(
                    "TEMPLATE_SERIALIZE_FAILED",
                    "Impossible de sérialiser les lignes.",
                    HttpStatus.INTERNAL_SERVER_ERROR.value());
        }
    }

    private List<Map<String, Object>> deserialize(String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            return Optional.<List<Map<String, Object>>>ofNullable(
                            objectMapper.readValue(json, LINES_TYPE))
                    .orElse(List.of());
        } catch (JsonProcessingException ex) {
            // Donnée corrompue côté DB : on log + on renvoie liste vide pour
            // ne pas casser l'écran ; le médecin pourra recréer le modèle.
            return List.of();
        }
    }

    private PrescriptionTemplateView toView(PrescriptionTemplate t) {
        List<Map<String, Object>> lines = deserialize(t.getLinesJson());
        return new PrescriptionTemplateView(
                t.getId(),
                t.getName(),
                t.getType(),
                lines,
                lines.size(),
                t.getUpdatedAt());
    }

    private BusinessException notFound() {
        return new BusinessException(
                "TEMPLATE_NOT_FOUND",
                "Modèle introuvable.",
                HttpStatus.NOT_FOUND.value());
    }
}
