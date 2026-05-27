package ma.careplus.notification.infrastructure.provider;

import java.util.LinkedHashMap;
import java.util.Map;
import ma.careplus.notification.application.NotificationProperties;
import ma.careplus.notification.application.spi.NotificationSender;
import ma.careplus.notification.application.spi.OutboxMessage;
import ma.careplus.notification.application.spi.SendResult;
import ma.careplus.notification.domain.NotificationChannel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

/**
 * Envoyeur WhatsApp via Meta Cloud API. N'est instancié que si un token Meta
 * est configuré ({@code careplus.notifications.whatsapp.meta.access-token}) —
 * sinon aucun bean → simulation.
 *
 * <p>v1 : envoi d'un message <b>texte</b> ({@code type=text}). Cela fonctionne
 * dans la fenêtre de service de 24 h. Pour l'initiation à froid (cas d'une
 * confirmation), Meta exige un <b>message template</b> approuvé : à brancher en
 * fournissant le {@code whatsapp_template_name} + ses paramètres (évolution
 * sans changement du contrat NotificationSender). Le payload est construit par
 * {@link #buildTextPayload} (testé sans réseau).
 */
@Component
@ConditionalOnProperty(prefix = "careplus.notifications.whatsapp.meta", name = "access-token")
public class WhatsAppSender implements NotificationSender {

    private final NotificationProperties props;
    private final RestClient http;

    public WhatsAppSender(NotificationProperties props, RestClient.Builder builder) {
        this.props = props;
        this.http = builder.build();
    }

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.WHATSAPP;
    }

    @Override
    public SendResult send(OutboxMessage message) {
        try {
            var meta = props.getWhatsapp().getMeta();
            String url = meta.getApiBase() + "/" + meta.getPhoneNumberId() + "/messages";
            http.post()
                    .uri(url)
                    .header("Authorization", "Bearer " + meta.getAccessToken())
                    .header("Content-Type", "application/json")
                    .body(buildTextPayload(message.toAddress(), message.body()))
                    .retrieve()
                    .toBodilessEntity();
            return SendResult.sent();
        } catch (RuntimeException ex) {
            return SendResult.failed(ex.getMessage());
        }
    }

    /**
     * Corps JSON Meta Cloud API pour un message texte. Extrait pour test de
     * contrat sans appel réseau.
     */
    public static Map<String, Object> buildTextPayload(String toE164, String body) {
        Map<String, Object> text = new LinkedHashMap<>();
        text.put("body", body);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messaging_product", "whatsapp");
        payload.put("to", normalize(toE164));
        payload.put("type", "text");
        payload.put("text", text);
        return payload;
    }

    /** Meta attend un numéro sans '+' ni espaces. */
    private static String normalize(String phone) {
        if (phone == null) return "";
        return phone.replaceAll("[^0-9]", "");
    }
}
