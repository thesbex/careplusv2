package ma.careplus.assistant.application;

import java.util.List;

/**
 * Abstraction du fournisseur d'IA conversationnelle. C'est <b>le</b> point de
 * configurabilité : changer de provider (Gemini → GPT → Claude…) consiste à
 * fournir une implémentation différente (ou à reconfigurer
 * {@link OpenAiCompatibleChatClient} via {@link AiProperties}). Le reste du
 * module ({@code AssistantService}, controller) ne dépend que de cette interface.
 */
public interface AiChatClient {

    /** Un tour de conversation : {@code role} ∈ {system, user, assistant}. */
    record AiMessage(String role, String content) {}

    /** Réponse du modèle + comptage de tokens si disponible. */
    record AiChatResult(String content, Integer promptTokens, Integer completionTokens) {}

    /**
     * Envoie la conversation au modèle et renvoie sa réponse.
     *
     * @throws ma.careplus.shared.error.BusinessException AI-002 si l'appel échoue.
     */
    AiChatResult complete(List<AiMessage> messages);

    /** Vrai si le client est prêt à servir (clé/URL présentes). */
    boolean isConfigured();

    /** Nom du provider actif (pour /config et les logs). */
    String provider();

    /** Modèle actif (pour /config). */
    String model();
}
