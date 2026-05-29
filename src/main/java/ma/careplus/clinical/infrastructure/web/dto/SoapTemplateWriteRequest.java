package ma.careplus.clinical.infrastructure.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Corps POST/PUT d'un modèle SOAP (nom requis ; les 4 sections optionnelles). */
public record SoapTemplateWriteRequest(
        @NotBlank @Size(max = 120) String name,
        String subjectif,
        String objectif,
        String analyse,
        String plan) {}
