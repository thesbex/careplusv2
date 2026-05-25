package ma.careplus.hospitalization.infrastructure.web.dto;

import java.util.UUID;

/** Vue d'un lit. {@code status} = état manuel (LIBRE/RESERVE/NETTOYAGE/HORS_SERVICE). */
public record BedView(UUID id, UUID roomId, String code, String status, boolean active) {}
