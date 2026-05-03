package ma.careplus.documents.domain;

/**
 * Catégories de documents historiques d'un dossier patient (QA2-2).
 *
 * Mappe directement la colonne {@code patient_document.type} (V009).
 * L'ordre est utilisé tel quel dans l'UI (drop-down du formulaire d'upload).
 */
public enum DocumentType {
    PRESCRIPTION_HISTORIQUE,
    ANALYSE,
    IMAGERIE,
    COMPTE_RENDU,
    AUTRE,
    /** Photo patient (avatar) — gérée via PatientPhotoController. QA5-3. */
    PHOTO,
    /** Résultat (PDF analyse, image radio) attaché à une ligne de prescription. V015. */
    RESULTAT
}
