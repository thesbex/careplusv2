package ma.careplus.notification.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration du module notifications (préfixe {@code careplus.notifications}).
 * Désactivé par défaut : aucune notification n'est composée tant que l'exploitant
 * ne l'active pas. Même activé, sans envoyeur réel configuré (pas de
 * {@code spring.mail.host}, pas de token Meta), les messages sont marqués
 * SENT_SIMULATED (aucun envoi).
 */
@Component
@ConfigurationProperties(prefix = "careplus.notifications")
public class NotificationProperties {

    /** Coupe-circuit maître. */
    private boolean enabled = false;

    /** Nombre maximal de tentatives d'envoi avant abandon. */
    private int maxAttempts = 5;

    private final Email email = new Email();
    private final Whatsapp whatsapp = new Whatsapp();

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }

    public Email getEmail() { return email; }
    public Whatsapp getWhatsapp() { return whatsapp; }

    /** Config email — l'envoi réel s'appuie sur {@code spring.mail.*} (SMTP). */
    public static class Email {
        /** Adresse expéditeur (From). */
        private String from = "";
        public String getFrom() { return from; }
        public void setFrom(String from) { this.from = from; }
    }

    /** Config WhatsApp Meta Cloud API. */
    public static class Whatsapp {
        private final Meta meta = new Meta();
        public Meta getMeta() { return meta; }

        public static class Meta {
            /** ID du numéro WhatsApp Business (Meta). */
            private String phoneNumberId = "";
            /** Jeton d'accès (variable d'env). Vide = WhatsAppSender dormant. */
            private String accessToken = "";
            /** Base de l'API Graph. */
            private String apiBase = "https://graph.facebook.com/v21.0";

            public String getPhoneNumberId() { return phoneNumberId; }
            public void setPhoneNumberId(String phoneNumberId) { this.phoneNumberId = phoneNumberId; }
            public String getAccessToken() { return accessToken; }
            public void setAccessToken(String accessToken) { this.accessToken = accessToken; }
            public String getApiBase() { return apiBase; }
            public void setApiBase(String apiBase) { this.apiBase = apiBase; }
        }
    }
}
