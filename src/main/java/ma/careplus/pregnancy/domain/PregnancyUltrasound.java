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
 * An obstetric ultrasound exam linked to a pregnancy.
 * Mapped to {@code pregnancy_ultrasound} (created by V026).
 *
 * <p>Field {@code biometryJson} stores JSONB:
 * {@code {"bip":num,"pc":num,"dat":num,"lf":num,"eg":num,"percentile":num}}.
 * {@code eg} (estimated gestational age in days) is used for due-date correction
 * when {@code kind == T1_DATATION && correctsDueDate == true}.
 */
@Entity
@Table(name = "pregnancy_ultrasound")
public class PregnancyUltrasound {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "pregnancy_id", nullable = false)
    private UUID pregnancyId;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 16)
    private UltrasoundKind kind;

    @Column(name = "performed_at", nullable = false)
    private LocalDate performedAt;

    @Column(name = "sa_weeks_at_exam", nullable = false)
    private short saWeeksAtExam;

    @Column(name = "sa_days_at_exam", nullable = false)
    private short saDaysAtExam;

    @Column(name = "findings", columnDefinition = "TEXT")
    private String findings;

    @Column(name = "document_id")
    private UUID documentId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "biometry", columnDefinition = "JSONB")
    private String biometryJson;

    @Column(name = "corrects_due_date", nullable = false)
    private boolean correctsDueDate = false;

    @Column(name = "recorded_by", nullable = false)
    private UUID recordedBy;

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

    public UUID getPregnancyId() { return pregnancyId; }
    public void setPregnancyId(UUID pregnancyId) { this.pregnancyId = pregnancyId; }

    public UltrasoundKind getKind() { return kind; }
    public void setKind(UltrasoundKind kind) { this.kind = kind; }

    public LocalDate getPerformedAt() { return performedAt; }
    public void setPerformedAt(LocalDate performedAt) { this.performedAt = performedAt; }

    public short getSaWeeksAtExam() { return saWeeksAtExam; }
    public void setSaWeeksAtExam(short saWeeksAtExam) { this.saWeeksAtExam = saWeeksAtExam; }

    public short getSaDaysAtExam() { return saDaysAtExam; }
    public void setSaDaysAtExam(short saDaysAtExam) { this.saDaysAtExam = saDaysAtExam; }

    public String getFindings() { return findings; }
    public void setFindings(String findings) { this.findings = findings; }

    public UUID getDocumentId() { return documentId; }
    public void setDocumentId(UUID documentId) { this.documentId = documentId; }

    public String getBiometryJson() { return biometryJson; }
    public void setBiometryJson(String biometryJson) { this.biometryJson = biometryJson; }

    public boolean isCorrectsDueDate() { return correctsDueDate; }
    public void setCorrectsDueDate(boolean correctsDueDate) { this.correctsDueDate = correctsDueDate; }

    public UUID getRecordedBy() { return recordedBy; }
    public void setRecordedBy(UUID recordedBy) { this.recordedBy = recordedBy; }

    public long getVersion() { return version; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public OffsetDateTime getUpdatedAt() { return updatedAt; }

    public UUID getCreatedBy() { return createdBy; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }

    public UUID getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(UUID updatedBy) { this.updatedBy = updatedBy; }
}
