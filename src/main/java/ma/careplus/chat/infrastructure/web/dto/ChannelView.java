package ma.careplus.chat.infrastructure.web.dto;

import java.util.UUID;

/**
 * Canal thématique pour le rail gauche maquette.
 * @param sub description courte (topic) — affichée sous le nom dans la liste mobile.
 * @param unread non lus du caller.
 * @param mentions @-mentions adressées au caller, non lues.
 * @param members nombre de membres.
 */
public record ChannelView(
        UUID id,
        String name,
        String sub,
        int unread,
        int mentions,
        int members) {}
