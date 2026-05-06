package ma.careplus.patient.infrastructure.web.dto;

/**
 * Compteurs des onglets affichés sur le dossier patient (bug B6).
 *
 * <p>Une clé par onglet du composant {@code DossierTabs} (frontend). Chaque
 * compteur reflète le nombre exact de lignes en base, soft-deletes filtrés
 * (là où la colonne {@code deleted_at} existe — actuellement
 * {@code patient_document} et {@code vaccination_dose}).
 *
 * <p>L'ensemble est servi par une requête SQL unique
 * ({@link ma.careplus.patient.application.PatientTabCountsService}) plutôt
 * qu'une rafale d'appels REST séparés — un seul aller-retour DB.
 *
 * Onglets non comptés (ils n'ont pas de badge dans l'UI) :
 *  - timeline (chronologie agrégée)
 *  - vitals (les constantes ne reportent pas un nombre)
 *  - vaccination (calendrier vaccinal — vue, pas un compteur)
 *  - grossesse (panneau, pas un compteur — la liste est dans /grossesses)
 */
public record PatientTabCountsView(
        long consultations,
        long prescriptions,
        long analyses,
        long imagerie,
        long documents,
        long facturation,
        long vaccinations,
        long grossesses
) {}
