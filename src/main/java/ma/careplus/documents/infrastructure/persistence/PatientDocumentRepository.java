package ma.careplus.documents.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.documents.domain.PatientDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatientDocumentRepository extends JpaRepository<PatientDocument, UUID> {

    /**
     * Liste tous les documents historiques actifs sauf les PHOTO patient (gérées
     * via PatientPhotoController et exposées comme avatar). QA5-3.
     */
    @Query("""
            SELECT d FROM PatientDocument d
             WHERE d.patientId = :patientId
               AND d.deletedAt IS NULL
               AND d.type <> ma.careplus.documents.domain.DocumentType.PHOTO
             ORDER BY d.uploadedAt DESC
            """)
    List<PatientDocument> findActiveByPatient(@Param("patientId") UUID patientId);

    @Query("""
            SELECT d FROM PatientDocument d
             WHERE d.id = :id
               AND d.deletedAt IS NULL
            """)
    Optional<PatientDocument> findActive(@Param("id") UUID id);

    /**
     * Photo courante (PHOTO la plus récente non supprimée). Utilisée par le
     * service photo pour soft-deleter l'ancienne au moment d'un remplacement.
     */
    @Query("""
            SELECT d FROM PatientDocument d
             WHERE d.patientId = :patientId
               AND d.deletedAt IS NULL
               AND d.type = ma.careplus.documents.domain.DocumentType.PHOTO
             ORDER BY d.uploadedAt DESC
            """)
    List<PatientDocument> findCurrentPhotos(@Param("patientId") UUID patientId);
}
