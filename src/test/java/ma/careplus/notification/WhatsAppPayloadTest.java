package ma.careplus.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import ma.careplus.notification.infrastructure.provider.WhatsAppSender;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Test de contrat (sans réseau) du payload Meta Cloud API construit par
 * {@link WhatsAppSender#buildTextPayload}. Garantit la forme JSON attendue par
 * l'API {@code POST /{phone-number-id}/messages}.
 */
class WhatsAppPayloadTest {

    @Test
    @DisplayName("payload texte Meta : forme + numéro normalisé (sans +/espaces)")
    @SuppressWarnings("unchecked")
    void buildTextPayload_shape() {
        Map<String, Object> payload = WhatsAppSender.buildTextPayload(
                "+212 600-000-001", "Votre RDV du 12/06/2030 à 09:00 est confirmé.");

        assertThat(payload.get("messaging_product")).isEqualTo("whatsapp");
        assertThat(payload.get("type")).isEqualTo("text");
        assertThat(payload.get("to")).isEqualTo("212600000001"); // sans + ni espaces ni tirets
        Map<String, Object> text = (Map<String, Object>) payload.get("text");
        assertThat(text.get("body")).isEqualTo("Votre RDV du 12/06/2030 à 09:00 est confirmé.");
    }
}
