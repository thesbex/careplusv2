package ma.careplus.documents.infrastructure.web.dto;

import java.time.Instant;
import java.util.UUID;
import ma.careplus.documents.domain.DocumentType;
import ma.careplus.documents.domain.PatientDocument;

public record PatientDocumentView(
        UUID id,
        UUID patientId,
        DocumentType type,
        String originalFilename,
        String mimeType,
        long sizeBytes,
        String notes,
        UUID uploadedBy,
        Instant uploadedAt
) {
    public static PatientDocumentView of(PatientDocument d) {
        return new PatientDocumentView(
                d.getId(),
                d.getPatientId(),
                d.getType(),
                d.getOriginalFilename(),
                d.getMimeType(),
                d.getSizeBytes(),
                d.getNotes(),
                d.getUploadedBy(),
                d.getUploadedAt()
        );
    }
}
