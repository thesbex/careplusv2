package ma.careplus.assistant.application;

import java.util.List;
import java.util.UUID;
import ma.careplus.assistant.infrastructure.web.dto.AiConfigView;
import ma.careplus.assistant.infrastructure.web.dto.AskRequest;
import ma.careplus.assistant.infrastructure.web.dto.ConversationDetailView;
import ma.careplus.assistant.infrastructure.web.dto.ConversationSummaryView;

/**
 * API publique du module assistant IA. Toutes les opérations sont cloisonnées
 * par {@code ownerId} (le médecin) — un utilisateur ne voit jamais les
 * conversations d'un autre.
 */
public interface AssistantService {

    /** État du provider IA (pour activer/désactiver l'IHM). */
    AiConfigView config();

    /** Mes conversations, plus récentes d'abord. */
    List<ConversationSummaryView> listConversations(UUID ownerId);

    /** Détail (en-tête + messages) d'une de mes conversations. 404 sinon. */
    ConversationDetailView getConversation(UUID ownerId, UUID conversationId);

    /**
     * Pose une question : crée la conversation si besoin, persiste le message
     * utilisateur, interroge le modèle (avec contexte patient si demandé),
     * persiste la réponse, et renvoie le fil à jour.
     */
    ConversationDetailView ask(UUID ownerId, AskRequest req);

    /** Supprime une de mes conversations (cascade messages). */
    void deleteConversation(UUID ownerId, UUID conversationId);
}
