export interface MedicationApi {
  id: string;
  name: string;
  molecule: string | null;
  form: string | null;
  strength: string | null;
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
  medication: MedicationApi | null;
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
