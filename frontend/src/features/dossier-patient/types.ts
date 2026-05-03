/**
 * Types for the Dossier patient screen (screen 03).
 * Derived from the prototype data shapes in dossier-patient.jsx and mobile/screens.jsx.
 * TODO(backend:J3): regenerate from zod schema once GET /api/patients/:id ships.
 */

export type TimelineEventKind = 'consult' | 'analyse' | 'doc';

export interface TimelineEvent {
  date: string;
  time: string;
  kind: TimelineEventKind;
  title: string;
  who?: string;
  summary?: string;
  tags: string[];
  live?: boolean;
}

export interface VitalEntry {
  k: string;
  v: string;
  warn?: boolean;
}

export interface Medication {
  name: string;
  posology: string;
}

export interface AdminEntry {
  k: string;
  v: string;
}

export interface PatientSummary {
  id: string;
  dossierNo: string;
  initials: string;
  fullName: string;
  sex: string;
  age: number;
  cin: string;
  birthDate: string;
  phone: string;
  email: string;
  bloodGroup: string;
  insurance: string;
  tier?: 'NORMAL' | 'PREMIUM';
  mutuelleInsuranceId?: string | null;
  mutuellePolicyNumber?: string | null;
  allergies: string[];
  allergyDetails?: { id: string; substance: string; severity: string }[];
  antecedentDetails?: { id: string; type: string; description: string }[];
  allergyNotes: string;
  antecedents: string;
  chronicTreatment: string;
  timeline: TimelineEvent[];
  lastVitals: VitalEntry[];
  lastVitalsDate: string;
  currentMedications: Medication[];
  currentMedicationsSince: string;
  admin: AdminEntry[];
}

export type DossierTab =
  | 'timeline'
  | 'consults'
  | 'prescr'
  | 'analyses'
  | 'imagerie'
  | 'docs'
  | 'factu';

export type MobileDossierTab =
  | 'historique'
  | 'consults'
  | 'rx'
  | 'factu'
  | 'admin';
