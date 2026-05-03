package ma.careplus.pregnancy.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * Pregnancy aggregate root. One row per pregnancy per patient (history preserved).
 * Tables: pregnancy.
 *
 * <p>JSONB field {@code fetuses} stores a minimal JSON array:
 * {@code [{"label":"Fœtus unique"}]} by default (multi-fetus support is out of MVP scope).
 *
 * <p>Soft-delete is NOT applied here: the pregnancy row is medically immutable
 * once closed. Status transitions are the only lifecycle changes allowed.
 */
@Entity
@Table(name = "pregnancy")
public class Pregnancy {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Column(name = "started_at", nullable = false)
    private LocalDate startedAt;

    @Column(name = "lmp_date", nullable = false)
    private LocalDate lmpDate;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "due_date_source", nullable = false, length = 10)
    private DueDateSource dueDateSource = DueDateSource.NAEGELE;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 12)
    private PregnancyStatus status = PregnancyStatus.EN_COURS;

    @Column(name = "ended_at")
    private LocalDate endedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "outcome", length = 22)
    private PregnancyOutcome outcome;

    @Column(name = "child_patient_id")
    private UUID childPatientId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "fetuses", nullable = false, columnDefinition = "JSONB")
    private String fetusesJson = "[{\"label\":\"F\\u0153tus unique\"}]";

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime createdAt;

    @Column(name = "updated_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private OffsetDateTime updatedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = OffsetDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = OffsetDateTime.now();
    }

    // ── Getters / setters ─────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }

    public LocalDate getStartedAt() { return startedAt; }
    public void setStartedAt(LocalDate startedAt) { this.startedAt = startedAt; }

    public LocalDate getLmpDate() { return lmpDate; }
    public void setLmpDate(LocalDate lmpDate) { this.lmpDate = lmpDate; }

    public LocalDate getDueDate() { return dueDate; }
    public void setDueDate(LocalDate dueDate) { this.dueDate = dueDate; }

    public DueDateSource getDueDateSource() { return dueDateSource; }
    public void setDueDateSource(DueDateSource dueDateSource) { this.dueDateSource = dueDateSource; }

    public PregnancyStatus getStatus() { return status; }
    public void setStatus(PregnancyStatus status) { this.status = status; }

    public LocalDate getEndedAt() { return endedAt; }
    public void setEndedAt(LocalDate endedAt) { this.endedAt = endedAt; }

    public PregnancyOutcome getOutcome() { return outcome; }
    public void setOutcome(PregnancyOutcome outcome) { this.outcome = outcome; }

    public UUID getChildPatientId() { return childPatientId; }
    public void setChildPatientId(UUID childPatientId) { this.childPatientId = childPatientId; }

    public String getFetusesJson() { return fetusesJson; }
    public void setFetusesJson(String fetusesJson) { this.fetusesJson = fetusesJson; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public long getVersion() { return version; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
