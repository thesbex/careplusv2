package ma.careplus.identity.infrastructure.web.dto;

import jakarta.validation.constraints.Size;

/**
 * Body de PUT /api/users/me/appearance (V073).
 *
 * <p>{@code appearance} = JSON d'apparence personnel à enregistrer. {@code null}
 * (ou absent) réinitialise l'override : l'utilisateur suit alors le défaut
 * d'apparence du cabinet. Borné à la taille de la colonne (VARCHAR 2000).
 */
public record UpdateMeAppearanceRequest(
        @Size(max = 2000) String appearance
) {}
