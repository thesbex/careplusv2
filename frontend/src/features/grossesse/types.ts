/**
 * TypeScript types for the Grossesse module.
 * Mirrors backend DTOs (V026) — see docs/plans/2026-05-03-grossesse-design.md.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type PregnancyStatus = 'EN_COURS' | 'TERMINEE' | 'INTERROMPUE';

export type PregnancyOutcome =
  | 'ACCOUCHEMENT_VIVANT'
  | 'MORT_NEE'
  | 'MFIU'
  | 'FCS'
  | 'IVG'
  | 'GEU'
  | 'MOLE';

export type DueDateSource = 'NAEGELE' | 'ECHO_T1';

export type UltrasoundKind = 'T1_DATATION' | 'T2_MORPHO' | 'T3_CROISSANCE' | 'AUTRE';

export type Presentation = 'CEPHALIQUE' | 'SIEGE' | 'TRANSVERSE' | 'INDETERMINEE';

export type VisitPlanStatus = 'PLANIFIEE' | 'HONOREE' | 'MANQUEE' | 'ANNULEE';

export type Trimester = 'T1' | 'T2' | 'T3';

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

// ── Backend DTOs ───────────────────────────────────────────────────────────

export interface Pregnancy {
  id: string;
  patientId: string;
  startedAt: string; // YYYY-MM-DD
  lmpDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  dueDateSource: DueDateSource;
  status: PregnancyStatus;
  endedAt: string | null;
  outcome: PregnancyOutcome | null;
  childPatientId: string | null;
  fetuses: { label: string }[];
  notes: string | null;
  /** Calculated SA — current weeks. Always present for status=EN_COURS. */
  saWeeks: number | null;
  saDays: number | null;
  /** G/P/A/V counters aggregated at patient level. */
  gravidity?: number;
  parity?: number;
  abortions?: number;
  livingChildren?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface UrineDip {
  glucose: boolean;
  protein: boolean;
  leuco: boolean;
  nitrites: boolean;
  ketones: boolean;
  blood: boolean;
}

export interface PregnancyVisit {
  id: string;
  pregnancyId: string;
  visitPlanId: string | null;
  consultationId: string | null;
  recordedAt: string; // ISO datetime
  saWeeks: number;
  saDays: number;
  weightKg: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  urineDip: UrineDip | null;
  fundalHeightCm: number | null;
  fetalHeartRateBpm: number | null;
  fetalMovementsPerceived: boolean | null;
  presentation: Presentation | null;
  notes: string | null;
  recordedBy: string;
  recordedByName?: string | null;
  version: number;
}

/** JSONB shape — keys depend on the ultrasound kind. Optional everywhere. */
export interface Biometry {
  bip?: number | undefined;
  pc?: number | undefined;
  dat?: number | undefined;
  lf?: number | undefined;
  eg?: number | undefined;
  percentile?: number | undefined;
  [key: string]: number | string | null | undefined;
}

export interface PregnancyUltrasound {
  id: string;
  pregnancyId: string;
  kind: UltrasoundKind;
  performedAt: string; // YYYY-MM-DD
  saWeeksAtExam: number;
  saDaysAtExam: number;
  findings: string | null;
  documentId: string | null;
  biometry: Biometry | null;
  correctsDueDate: boolean;
  recordedBy: string;
  version: number;
}

export interface PregnancyVisitPlanEntry {
  id: string;
  pregnancyId: string;
  targetSaWeeks: number;
  targetDate: string;
  toleranceDays: number;
  status: VisitPlanStatus;
  appointmentId: string | null;
  consultationId: string | null;
}

export interface PregnancyAlert {
  code: string;
  label: string;
  severity: AlertSeverity;
  since: string; // ISO date
}

// ── Request bodies ─────────────────────────────────────────────────────────

export interface DeclarePregnancyRequest {
  lmpDate: string;
  notes?: string;
}

export interface UpdatePregnancyRequest {
  lmpDate?: string;
  dueDate?: string;
  dueDateSource?: DueDateSource;
  notes?: string;
}

export interface ClosePregnancyRequest {
  endedAt: string;
  outcome: PregnancyOutcome;
  notes?: string;
}

export interface CreateChildRequest {
  firstName: string;
  sex: 'M' | 'F';
}

export interface RecordVisitRequest {
  visitPlanId?: string;
  consultationId?: string;
  recordedAt: string;
  weightKg?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  urineDip?: UrineDip;
  fundalHeightCm?: number;
  fetalHeartRateBpm?: number;
  fetalMovementsPerceived?: boolean;
  presentation?: Presentation;
  notes?: string;
}

export interface RecordUltrasoundRequest {
  kind: UltrasoundKind;
  performedAt: string;
  saWeeksAtExam: number;
  saDaysAtExam: number;
  findings?: string;
  biometry?: Biometry;
  correctsDueDate: boolean;
  documentId?: string;
}

// ── UI helpers ─────────────────────────────────────────────────────────────

export const OUTCOME_LABEL: Record<PregnancyOutcome, string> = {
  ACCOUCHEMENT_VIVANT: 'Accouchement (enfant vivant)',
  MORT_NEE: 'Mort-né',
  MFIU: 'Mort fœtale in utero',
  FCS: 'Fausse couche spontanée',
  IVG: 'Interruption volontaire de grossesse',
  GEU: 'Grossesse extra-utérine',
  MOLE: 'Môle hydatiforme',
};

export const STATUS_LABEL: Record<PregnancyStatus, string> = {
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
  INTERROMPUE: 'Interrompue',
};

export const PRESENTATION_LABEL: Record<Presentation, string> = {
  CEPHALIQUE: 'Céphalique',
  SIEGE: 'Siège',
  TRANSVERSE: 'Transverse',
  INDETERMINEE: 'Indéterminée',
};

export const ULTRASOUND_KIND_LABEL: Record<UltrasoundKind, string> = {
  T1_DATATION: 'T1 — Datation / clarté nucale',
  T2_MORPHO: 'T2 — Morphologique',
  T3_CROISSANCE: 'T3 — Croissance',
  AUTRE: 'Autre',
};

export const VISIT_PLAN_STATUS_LABEL: Record<VisitPlanStatus, string> = {
  PLANIFIEE: 'Planifiée',
  HONOREE: 'Honorée',
  MANQUEE: 'Manquée',
  ANNULEE: 'Annulée',
};

/** Format a Date (or YYYY-MM-DD) into local YYYY-MM-DD without UTC drift. */
export function toLocalDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
