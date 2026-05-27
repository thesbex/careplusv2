package ma.careplus.notification.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Configuration du module notifications (préfixe {@code careplus.notifications}).
 * Désactivé par défaut : aucune notification n'est composée tant que l'ADMIN /
 * l'exploitant ne l'active pas explicitement. Même activé, sans envoyeur réel
 * configuré (phase 4), les messages sont marqués SENT_SIMULATED (aucun envoi).
 */
@Component
@ConfigurationProperties(prefix = "careplus.notifications")
public class NotificationProperties {

    /** Coupe-circuit maître. */
    private boolean enabled = false;

    /** Nombre maximal de tentatives d'envoi avant abandon. */
    private int maxAttempts = 5;

    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }

    public int getMaxAttempts() { return maxAttempts; }
    public void setMaxAttempts(int maxAttempts) { this.maxAttempts = maxAttempts; }
}
