package ma.careplus.notification.infrastructure.provider;

import ma.careplus.notification.application.NotificationProperties;
import ma.careplus.notification.application.spi.NotificationSender;
import ma.careplus.notification.application.spi.OutboxMessage;
import ma.careplus.notification.application.spi.SendResult;
import ma.careplus.notification.domain.NotificationChannel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/**
 * Envoyeur email via SMTP ({@link JavaMailSender}). N'est instancié que si
 * {@code spring.mail.host} est configuré — sinon aucun bean → le dispatcher
 * retombe sur la simulation. Le cabinet branche le fournisseur gratuit de son
 * choix (Gmail, Brevo, serveur propre) via {@code spring.mail.*}.
 */
@Component
@ConditionalOnProperty(prefix = "spring.mail", name = "host")
public class EmailSender implements NotificationSender {

    private final JavaMailSender mailSender;
    private final NotificationProperties props;

    public EmailSender(JavaMailSender mailSender, NotificationProperties props) {
        this.mailSender = mailSender;
        this.props = props;
    }

    @Override
    public NotificationChannel channel() {
        return NotificationChannel.EMAIL;
    }

    @Override
    public SendResult send(OutboxMessage message) {
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            String from = props.getEmail().getFrom();
            if (from != null && !from.isBlank()) {
                mail.setFrom(from);
            }
            mail.setTo(message.toAddress());
            mail.setSubject(message.subject() == null ? "" : message.subject());
            mail.setText(message.body());
            mailSender.send(mail);
            return SendResult.sent();
        } catch (RuntimeException ex) {
            return SendResult.failed(ex.getMessage());
        }
    }
}
