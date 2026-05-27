package ma.careplus.assistant.infrastructure.web.dto;

/**
 * État du module assistant pour le frontend (aucune donnée sensible).
 * {@code configured=false} → l'IHM affiche un message « non configuré » et
 * désactive la saisie.
 */
public record AiConfigView(boolean enabled, boolean configured, String provider, String model) {}
