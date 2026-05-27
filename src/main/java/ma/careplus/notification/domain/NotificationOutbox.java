package ma.careplus.notification.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Ligne d'outbox : une notification rendue, prête à partir (ou déjà partie).
 * Idempotence via {@code dedupeKey} (UNIQUE). Tolérance hors-ligne : reste
 * {@code PENDING} jusqu'à envoi.
 */
@Entity
@Table(name = "notification_outbox")
public class NotificationOutbox {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "event_key", nullable = false, length = 40)
    private String eventKey;

    @Column(name = "channel", nullable = false, length = 16)
    private String channel;

    @Column(name = "recipient_patient_id")
    private UUID recipientPatientId;

    @Column(name = "to_address", nullable = false, length = 255)
    private String toAddress;

    @Column(name = "rendered_subject", length = 200)
    private String renderedSubject;

    @Column(name = "rendered_body", nullable = false, columnDefinition = "TEXT")
    private String renderedBody;

    @Column(name = "status", nullable = false, length = 16)
    private String status = NotificationStatus.PENDING.name();

    @Column(name = "attempts", nullable = false)
    private int attempts = 0;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Column(name = "dedupe_key", nullable = false, length = 120)
    private String dedupeKey;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "sent_at", columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime sentAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }

    public String getEventKey() { return eventKey; }
    public void setEventKey(String eventKey) { this.eventKey = eventKey; }

    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }

    public UUID getRecipientPatientId() { return recipientPatientId; }
    public void setRecipientPatientId(UUID recipientPatientId) { this.recipientPatientId = recipientPatientId; }

    public String getToAddress() { return toAddress; }
    public void setToAddress(String toAddress) { this.toAddress = toAddress; }

    public String getRenderedSubject() { return renderedSubject; }
    public void setRenderedSubject(String renderedSubject) { this.renderedSubject = renderedSubject; }

    public String getRenderedBody() { return renderedBody; }
    public void setRenderedBody(String renderedBody) { this.renderedBody = renderedBody; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getAttempts() { return attempts; }
    public void setAttempts(int attempts) { this.attempts = attempts; }

    public String getLastError() { return lastError; }
    public void setLastError(String lastError) { this.lastError = lastError; }

    public String getDedupeKey() { return dedupeKey; }
    public void setDedupeKey(String dedupeKey) { this.dedupeKey = dedupeKey; }

    public OffsetDateTime getCreatedAt() { return createdAt; }

    public OffsetDateTime getSentAt() { return sentAt; }
    public void setSentAt(OffsetDateTime sentAt) { this.sentAt = sentAt; }
}
