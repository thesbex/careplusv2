export interface MedicationApi {
  id: string;
  name: string;
  molecule: string | null;
  form: string | null;
  strength: string | null;
  /** V057 — prix de cession en interne (null = pas de prix → non facturable). */
  internalPrice: number | null;
}

export interface LabTestApi {
  id: string;
  code: string;
  name: string;
  category: string | null;
}

export interface ImagingExamApi {
  id: string;
  code: string;
  name: string;
  modality: string | null;
}

/** Common shape any catalog item collapses into for the line UI. */
export interface CatalogItem {
  id: string;
  name: string;
  sub?: string | null;
  /**
   * V057 — pour les médicaments : prix de cession interne. `null` = pas de prix
   * (ne sera pas facturé en interne) ; `undefined` = inconnu (ligne issue d'un
   * modèle, prix non chargé) → pas d'avertissement.
   */
  internalPrice?: number | null;
}

export interface PrescriptionLineApi {
  id: string;
  medicationId: string | null;
  labTestId: string | null;
  imagingExamId: string | null;
  freeText: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  route: string | null;
  timing: string | null;
  quantity: number | null;
  instructions: string | null;
  sortOrder: number;
  /** V015 — résultat (PDF/image) attaché à cette ligne (LAB/IMAGING uniquement). */
  resultDocumentId: string | null;
  /** V045 — résultat saisi en texte/chiffré, complémentaire au PDF. */
  resultText: string | null;
}

export interface PrescriptionApi {
  id: string;
  consultationId: string;
  patientId: string;
  type: string | null;
  issuedAt: string;
  lines: PrescriptionLineApi[];
  allergyOverride: boolean;
}

export type PrescriptionType = 'DRUG' | 'LAB' | 'IMAGING' | 'CERT' | 'SICK_LEAVE';

export interface PrescriptionLineDraft {
  /** Selected catalog item — its semantic depends on the prescription type
   *  (medication for DRUG, lab test for LAB, imaging exam for IMAGING). */
  item: CatalogItem | null;
  /** Backwards-compat alias used by some legacy code paths. */
  medication?: MedicationApi | null;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number | null;
  instructions: string;
}

export interface AllergyConflict {
  medication: string;
  allergy: string;
}
