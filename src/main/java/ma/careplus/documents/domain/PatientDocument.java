package ma.careplus.documents.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * Métadonnée d'un document patient. Le binaire vit sur le disque
 * sous {@code careplus.documents.root/<storage_key>}.
 */
@Entity
@Table(name = "patient_document")
public class PatientDocument {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "patient_id", nullable = false)
    private UUID patientId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 32)
    private DocumentType type;

    @Column(name = "original_filename", nullable = false, columnDefinition = "TEXT")
    private String originalFilename;

    @Column(name = "mime_type", nullable = false, length = 128)
    private String mimeType;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(name = "storage_key", nullable = false, columnDefinition = "TEXT")
    private String storageKey;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "uploaded_by", nullable = false)
    private UUID uploadedBy;

    @Column(name = "uploaded_at", nullable = false, columnDefinition = "TIMESTAMPTZ")
    private Instant uploadedAt;

    @Column(name = "deleted_at", columnDefinition = "TIMESTAMPTZ")
    private Instant deletedAt;

    @PrePersist
    void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (uploadedAt == null) uploadedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getPatientId() { return patientId; }
    public void setPatientId(UUID patientId) { this.patientId = patientId; }
    public DocumentType getType() { return type; }
    public void setType(DocumentType type) { this.type = type; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String f) { this.originalFilename = f; }
    public String getMimeType() { return mimeType; }
    public void setMimeType(String m) { this.mimeType = m; }
    public long getSizeBytes() { return sizeBytes; }
    public void setSizeBytes(long s) { this.sizeBytes = s; }
    public String getStorageKey() { return storageKey; }
    public void setStorageKey(String k) { this.storageKey = k; }
    public String getNotes() { return notes; }
    public void setNotes(String n) { this.notes = n; }
    public UUID getUploadedBy() { return uploadedBy; }
    public void setUploadedBy(UUID by) { this.uploadedBy = by; }
    public Instant getUploadedAt() { return uploadedAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant t) { this.deletedAt = t; }
}
