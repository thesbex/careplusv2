package ma.careplus.assistant.application;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import ma.careplus.shared.error.BusinessException;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Implémentation par défaut de {@link AiChatClient}, parlant le protocole
 * <i>OpenAI Chat Completions</i> ({@code POST {baseUrl}/chat/completions}).
 *
 * <p>Couvre d'emblée Gemini (endpoint de compatibilité OpenAI de Google),
 * OpenAI/GPT, Groq et Ollama : tous exposent le même contrat. Le provider est
 * choisi par configuration ({@link AiProperties}). Pour Claude (Anthropic),
 * dont le schéma diffère, on ajoutera un {@code AnthropicChatClient} séparé —
 * voir le javadoc d'{@link AiProperties}.
 */
@Component
public class OpenAiCompatibleChatClient implements AiChatClient {

    private final AiProperties props;
    private final ObjectMapper mapper;
    private final RestClient http;

    public OpenAiCompatibleChatClient(AiProperties props, ObjectMapper mapper) {
        this.props = props;
        this.mapper = mapper;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout((int) Duration.ofSeconds(10).toMillis());
        factory.setReadTimeout((int) Duration.ofSeconds(props.getTimeoutSeconds()).toMillis());

        this.http = RestClient.builder()
                .requestFactory(factory)
                .build();
    }

    @Override
    public AiChatResult complete(List<AiMessage> messages) {
        if (!isConfigured()) {
            throw new BusinessException("AI-001",
                    "Assistant IA non configuré (clé API manquante).", 503);
        }

        List<Map<String, String>> payloadMessages = new ArrayList<>();
        for (AiMessage m : messages) {
            payloadMessages.add(Map.of("role", m.role(), "content", m.content()));
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", props.getModel());
        body.put("messages", payloadMessages);
        body.put("temperature", props.getTemperature());
        body.put("max_tokens", props.getMaxTokens());

        try {
            String raw = http.post()
                    .uri(props.getBaseUrl() + "/chat/completions")
                    .header("Authorization", "Bearer " + props.getApiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);

            JsonNode root = mapper.readTree(raw);
            JsonNode choices = root.path("choices");
            if (!choices.isArray() || choices.isEmpty()) {
                throw new BusinessException("AI-002",
                        "Réponse vide du fournisseur IA.", 502);
            }
            String content = choices.get(0).path("message").path("content").asText("");
            JsonNode usage = root.path("usage");
            Integer promptTokens = usage.hasNonNull("prompt_tokens")
                    ? usage.get("prompt_tokens").asInt() : null;
            Integer completionTokens = usage.hasNonNull("completion_tokens")
                    ? usage.get("completion_tokens").asInt() : null;

            if (content.isBlank()) {
                throw new BusinessException("AI-002",
                        "Le fournisseur IA n'a renvoyé aucun texte.", 502);
            }
            return new AiChatResult(content.trim(), promptTokens, completionTokens);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("AI-002",
                    "Échec de l'appel au fournisseur IA : " + e.getMessage(), 502);
        }
    }

    @Override
    public boolean isConfigured() {
        return props.isConfigured();
    }

    @Override
    public String provider() {
        return props.getProvider();
    }

    @Override
    public String model() {
        return props.getModel();
    }
}
