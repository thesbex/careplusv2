package ma.careplus.assistant.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration de l'assistant IA — {@code careplus.ai.*}.
 *
 * <p>Provider <b>configurable</b> : par défaut Gemini (free tier Google), mais
 * l'architecture est volontairement neutre. Gemini, OpenAI (GPT) et Groq
 * exposent tous une API <i>OpenAI-compatible</i> {@code POST /chat/completions} ;
 * basculer de l'un à l'autre = changer {@code provider} / {@code base-url} /
 * {@code model} / {@code api-key} (cf. {@link OpenAiCompatibleChatClient}).
 * Claude (Anthropic) a un schéma d'API différent : l'ajouter consiste à fournir
 * une seconde implémentation de {@link AiChatClient} sélectionnée par
 * {@code provider=anthropic} — aucun autre code applicatif ne change.
 *
 * <p>Aucune valeur sensible n'est commitée : {@code api-key} vient d'une variable
 * d'environnement (ex. {@code GEMINI_API_KEY}). Sans clé, le module se déclare
 * « non configuré » et les endpoints renvoient 503 proprement.
 */
@Component
@ConfigurationProperties(prefix = "careplus.ai")
public class AiProperties {

    /** Active/désactive le module assistant (kill-switch). */
    private boolean enabled = true;

    /** Identifiant lisible du provider : gemini | openai | groq | ollama | anthropic. */
    private String provider = "gemini";

    /** Base URL de l'API OpenAI-compatible (sans le suffixe /chat/completions). */
    private String baseUrl = "https://generativelanguage.googleapis.com/v1beta/openai";

    /** Modèle à interroger (les 1.x sont retirés ; 2.5-flash = gratuit/rapide courant). */
    private String model = "gemini-2.5-flash";

    /** Clé API — externalisée par variable d'environnement. Vide = non configuré. */
    private String apiKey = "";

    /** Créativité du modèle (0 = déterministe ; on reste bas pour le contexte médical). */
    private double temperature = 0.3;

    /** Plafond de tokens générés par réponse. */
    private int maxTokens = 1024;

    /** Timeout réseau de l'appel au provider, en secondes. */
    private int timeoutSeconds = 60;

    /**
     * Consigne système injectée en tête de chaque conversation. Cadre le rôle de
     * l'assistant et rappelle qu'il n'est qu'une aide à la décision, jamais un
     * substitut au jugement clinique.
     */
    private String systemPrompt = """
            Tu es un assistant médical destiné à un médecin généraliste exerçant au Maroc.
            Réponds en français, de façon concise, structurée et factuelle.
            Tu peux aider sur : conduite à tenir, posologies, interactions médicamenteuses,
            diagnostics différentiels, synthèse de dossier. Cite les éléments de prudence
            (contre-indications, signes de gravité) quand ils sont pertinents.
            Tu es une aide à la décision : rappelle, si le cas est complexe ou incertain,
            que la décision finale revient au médecin et qu'un avis spécialisé peut être requis.
            N'invente jamais de données patient ; si une information manque, dis-le.
            """;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }

    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }

    public String getModel() { return model; }
    public void setModel(String model) { this.model = model; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }

    public double getTemperature() { return temperature; }
    public void setTemperature(double temperature) { this.temperature = temperature; }

    public int getMaxTokens() { return maxTokens; }
    public void setMaxTokens(int maxTokens) { this.maxTokens = maxTokens; }

    public int getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(int timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }

    public String getSystemPrompt() { return systemPrompt; }
    public void setSystemPrompt(String systemPrompt) { this.systemPrompt = systemPrompt; }

    /** Vrai si une clé API est présente (ou provider local type ollama). */
    public boolean isConfigured() {
        if (!enabled) return false;
        // Ollama tourne en local sans clé.
        if ("ollama".equalsIgnoreCase(provider)) return baseUrl != null && !baseUrl.isBlank();
        return apiKey != null && !apiKey.isBlank();
    }
}
