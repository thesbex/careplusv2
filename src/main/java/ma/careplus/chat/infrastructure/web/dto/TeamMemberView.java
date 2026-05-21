package ma.careplus.chat.infrastructure.web.dto;

import java.util.UUID;

/**
 * Membre de l'équipe avec présence + couleur dérivée.
 * @param presence 'self' | 'on' | 'away' | 'off'. v1 : enabled=TRUE → 'on', user courant → 'self', sinon 'off'.
 */
public record TeamMemberView(
        UUID id,
        String name,
        String role,
        String initials,
        String color,
        String presence) {}
