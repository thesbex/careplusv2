/**
 * Types for the Consultation (SOAP) screen (screen 06).
 * Derived from the prototype shapes in screens/consultation.jsx and
 * mobile/screens.jsx (MConsultation block).
 * TODO(backend:J5): regenerate from zod schema once consultation module ships.
 */

export type ConsultationState = 'Brouillon' | 'Signée';

export type SoapSection = 'subjectif' | 'objectif' | 'analyse' | 'plan';

export interface ConsultationFormValues {
  subjectif: string;
  objectif: string;
  analyse: string;
  plan: string;
}

export interface DiagEntry {
  code: string;
  label: string;
}

export interface PlanEntry {
  ico: string;
  text: string;
  active?: boolean;
}

export interface VitalEntry {
  k: string;
  v: string;
  warn?: boolean;
}

export interface Medication {
  name: string;
  posology: string;
  since: string;
}

export interface FollowUpEntry {
  date: string;
  note: string;
}

export interface ConsultationPatient {
  initials: string;
  fullName: string;
  age: number;
  sex: string;
  dossierNo: string;
  allergy: string;
  conditions: string;
  vitalsTime: string;
  vitals: VitalEntry[];
  currentMedications: Medication[];
  followUps: FollowUpEntry[];
}

export interface ConsultationSession {
  patientName: string;
  startedAt: string;
  box: string;
  timer: string;
  status: ConsultationState;
  autoSavedAt: string;
  soap: ConsultationFormValues;
  diagnoses: DiagEntry[];
  plan: PlanEntry[];
}

export interface BillingLine {
  label: string;
  amount: string;
}
