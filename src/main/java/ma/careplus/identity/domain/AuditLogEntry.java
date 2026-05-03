package ma.careplus.identity.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "identity_audit_log")
public class AuditLogEntry {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "occurred_at", nullable = false, updatable = false,
            columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime occurredAt;

    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "action", nullable = false, length = 64)
    private String action;

    @Column(name = "entity_type", length = 64)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @Column(name = "before_json", columnDefinition = "JSONB")
    private String beforeJson;

    @Column(name = "after_json", columnDefinition = "JSONB")
    private String afterJson;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "correlation_id", length = 64)
    private String correlationId;

    protected AuditLogEntry() {}

    public AuditLogEntry(UUID id, UUID userId, String action, String entityType,
                         UUID entityId, String ipAddress, String correlationId) {
        this.id = id;
        this.userId = userId;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
        this.ipAddress = ipAddress;
        this.correlationId = correlationId;
        this.occurredAt = OffsetDateTime.now();
    }

    public UUID getId() { return id; }
    public OffsetDateTime getOccurredAt() { return occurredAt; }
    public UUID getUserId() { return userId; }
    public String getAction() { return action; }
    public String getEntityType() { return entityType; }
    public UUID getEntityId() { return entityId; }
    public String getBeforeJson() { return beforeJson; }
    public void setBeforeJson(String beforeJson) { this.beforeJson = beforeJson; }
    public String getAfterJson() { return afterJson; }
    public void setAfterJson(String afterJson) { this.afterJson = afterJson; }
    public String getIpAddress() { return ipAddress; }
    public String getCorrelationId() { return correlationId; }
}
