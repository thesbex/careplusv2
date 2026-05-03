package ma.careplus.documents.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import ma.careplus.documents.domain.PatientDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PatientDocumentRepository extends JpaRepository<PatientDocument, UUID> {

    @Query("""
            SELECT d FROM PatientDocument d
             WHERE d.patientId = :patientId
               AND d.deletedAt IS NULL
             ORDER BY d.uploadedAt DESC
            """)
    List<PatientDocument> findActiveByPatient(@Param("patientId") UUID patientId);

    @Query("""
            SELECT d FROM PatientDocument d
             WHERE d.id = :id
               AND d.deletedAt IS NULL
            """)
    Optional<PatientDocument> findActive(@Param("id") UUID id);
}
