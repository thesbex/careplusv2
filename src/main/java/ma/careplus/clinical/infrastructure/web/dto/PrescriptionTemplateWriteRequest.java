package ma.careplus.clinical.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

/**
 * Création / mise à jour d'un modèle de prescription. {@code lines} est un
 * tableau d'objets dont la forme dépend de {@code type} :
 *   DRUG    : [{ medicationId, medicationCode, dosage, frequency, duration, quantity, instructions }]
 *   LAB     : [{ labTestId, labTestCode, instructions }]
 *   IMAGING : [{ imagingExamId, imagingExamCode, instructions }]
 * Le service valide la forme par ligne avant persist (champ obligatoire :
 * l'identifiant catalogue de chaque ligne).
 */
public record PrescriptionTemplateWriteRequest(
        @NotBlank @Size(max = 120) String name,
        @NotBlank @Pattern(regexp = "DRUG|LAB|IMAGING") String type,
        @NotEmpty @Size(max = 20) List<Map<String, Object>> lines) {}
