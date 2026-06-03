package ma.careplus.identity.infrastructure.web.dto;

/**
 * Réponse de GET/PUT /api/users/me/appearance (V073).
 *
 * <p>{@code appearance} est le JSON d'apparence personnel de l'utilisateur, ou
 * {@code null} s'il suit le défaut d'apparence du cabinet (V072).
 */
public record MeAppearanceView(String appearance) {}
