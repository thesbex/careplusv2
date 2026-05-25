package ma.careplus.hospitalization.infrastructure.web.dto;

import java.util.UUID;

/** Vue d'un service / unité d'hospitalisation. */
public record WardView(UUID id, String code, String labelFr, boolean active) {}
