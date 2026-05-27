package ma.careplus.notification.application;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Active le support {@code @Scheduled} (rappel RDV J-1). */
@Configuration
@EnableScheduling
public class NotificationSchedulingConfig {
}
