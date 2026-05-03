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
     * Liste tous les documents historiques actifs SAUF :
     *   - les PHOTO patient (gérées comme avatar — QA5-3),
     *   - les RESULTAT attachés à une ligne de prescription (V015) :
     *     ils s'affichent sur la ligne, pas dans la liste générale,
     *     pour ne pas dupliquer.
     */
    @Query("""
            SELECT d FROM PatientDocument d
             WHERE d.patientId = :patientId
               AND d.deletedAt IS NULL
               AND d.type <> ma.careplus.documents.domain.DocumentType.PHOTO
               AND d.type <> ma.careplus.documents.domain.DocumentType.RESULTAT
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

    /**
     * Résultat actif (RESULTAT non supprimé) pour un patient donné. Filtré
     * sur l'id du document précis qu'on s'apprête à remplacer/détacher,
     * pour éviter de soft-deleter un autre résultat appartenant à une
     * autre ligne.
     */
    @Query("""
            SELECT d FROM PatientDocument d
             WHERE d.id = :docId
               AND d.deletedAt IS NULL
               AND d.type = ma.careplus.documents.domain.DocumentType.RESULTAT
            """)
    Optional<PatientDocument> findActiveResult(@Param("docId") UUID docId);
}
