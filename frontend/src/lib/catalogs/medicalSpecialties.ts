/**
 * Catalogue des spécialités médicales courantes — Maroc.
 *
 * Liste consensus issue de l'ordre des médecins marocain + spécialités CNOM.
 * Sert au picker du carnet de confrères (V046 — `ReferralContactsSection`) et
 * à tout futur formulaire qui propose un choix de spécialité.
 *
 * Si une spécialité manque (rare), l'utilisateur garde la possibilité de la
 * saisir en libre via l'option "Autre…" du picker.
 */

export const MEDICAL_SPECIALTIES: readonly string[] = [
  'Médecine générale',
  'Allergologie',
  'Anatomopathologie',
  'Anesthésie-réanimation',
  'Biologie médicale',
  'Cardiologie',
  'Chirurgie cardio-vasculaire',
  'Chirurgie générale',
  'Chirurgie orthopédique et traumatologique',
  'Chirurgie pédiatrique',
  'Chirurgie plastique et reconstructrice',
  'Chirurgie thoracique',
  'Chirurgie urologique',
  'Chirurgie viscérale',
  'Dermatologie',
  'Endocrinologie',
  'Gastro-entérologie',
  'Gériatrie',
  'Gynécologie-obstétrique',
  'Hématologie',
  'Hépato-gastro-entérologie',
  'Imagerie médicale / Radiologie',
  'Médecine du sport',
  'Médecine du travail',
  'Médecine interne',
  'Médecine nucléaire',
  'Médecine physique et réadaptation',
  'Néphrologie',
  'Neurochirurgie',
  'Neurologie',
  'Oncologie médicale',
  'Ophtalmologie',
  'ORL (Oto-rhino-laryngologie)',
  'Pédiatrie',
  'Pneumologie',
  'Psychiatrie',
  'Radiothérapie',
  'Rhumatologie',
  'Stomatologie',
  'Urologie',
];

/** Valeur sentinelle pour proposer la saisie libre. */
export const SPECIALTY_OTHER = '__OTHER__';
