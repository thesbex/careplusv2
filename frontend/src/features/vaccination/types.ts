/**
 * TypeScript types for the Vaccination module.
 * Mirrors backend DTOs from VaccinationCalendarEntry, RecordDoseRequest,
 * DeferDoseRequest, UpdateDoseRequest, VaccineCatalogDto, VaccineScheduleDoseDto.
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type DoseStatus =
  | 'UPCOMING'
  | 'DUE_SOON'
  | 'OVERDUE'
  | 'ADMINISTERED'
  | 'DEFERRED'
  | 'SKIPPED';

export type RouteAdmin = 'IM' | 'SC' | 'PO' | 'ID';

// ── Backend DTOs ───────────────────────────────────────────────────────────

/** Mirrors backend VaccinationCalendarEntry */
export interface VaccinationCalendarEntry {
  /** UUID — null when the dose has not yet been materialised in DB */
  id: string | null;
  scheduleDoseId: string | null;
  vaccineId: string;
  vaccineCode: string;
  vaccineName: string;
  doseNumber: number;
  doseLabel: string;
  targetDate: string; // ISO date "YYYY-MM-DD"
  toleranceDays: number;
  status: DoseStatus;
  administeredAt: string | null; // ISO datetime
  lotNumber: string | null;
  route: RouteAdmin | null;
  site: string | null;
  administeredByName: string | null;
  deferralReason: string | null;
  notes: string | null;
  version: number | null;
}

/** Mirrors backend VaccineCatalogDto */
export interface VaccineCatalogEntry {
  id: string;
  code: string;
  nameFr: string;
  manufacturerDefault: string | null;
  routeDefault: RouteAdmin | null;
  isPni: boolean;
  active: boolean;
}

/** Mirrors backend RecordDoseRequest */
export interface RecordDoseRequest {
  vaccineId: string;
  doseNumber: number;
  scheduleDoseId?: string;
  administeredAt: string; // ISO datetime
  lotNumber: string;
  route?: RouteAdmin;
  site?: string;
  administeredBy?: string; // UUID user id
  notes?: string;
}

/** Mirrors backend DeferDoseRequest */
export interface DeferDoseRequest {
  reason: string;
}

/** Mirrors backend UpdateDoseRequest — all nullable except version */
export interface UpdateDoseRequest {
  vaccineId?: string | null;
  doseNumber?: number | null;
  administeredAt?: string | null;
  lotNumber?: string | null;
  route?: RouteAdmin | null;
  site?: string | null;
  administeredBy?: string | null;
  notes?: string | null;
  version: number;
}

// ── UI helpers ─────────────────────────────────────────────────────────────

/** Age-group section used in the timeline display */
export type AgeGroup =
  | 'naissance'
  | '2-mois'
  | '4-mois'
  | '12-mois'
  | '18-mois'
  | '5-ans'
  | '11-ans'
  | 'hors-calendrier';

export const AGE_GROUP_LABEL: Record<AgeGroup, string> = {
  'naissance': 'Naissance',
  '2-mois': '2 mois',
  '4-mois': '4 mois',
  '12-mois': '12 mois',
  '18-mois': '18 mois',
  '5-ans': '5 ans',
  '11-ans': '11 ans',
  'hors-calendrier': 'Hors calendrier',
};

/** Drawer display mode */
export type DrawerMode = 'record' | 'view' | 'edit';

/** Site suggestions for dose injection */
export const SITE_SUGGESTIONS = [
  'Deltoïde G',
  'Deltoïde D',
  'Vaste latéral G',
  'Vaste latéral D',
  'Oral',
  'Intradermique',
] as const;

export type SiteSuggestion = (typeof SITE_SUGGESTIONS)[number];
