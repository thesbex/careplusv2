/**
 * Mock fixtures for the Prise des constantes screen (screen 05).
 * Lifted verbatim from design/prototype/screens/prise-constantes.jsx.
 *
 * When the J5 backend (vitals module) ships, useRecordVitals.ts will
 * POST /api/appointments/:id/vitals and replace the mock submission.
 * The previous-vitals fixture will come from GET /api/patients/:id/vitals/last.
 */
import type { PreviousVitalEntry } from './types';

/** Patient being served — Youssef Ziani, from salle-attente prototype. */
export const CURRENT_PATIENT = {
  initials: 'YZ',
  fullName: 'Youssef Ziani',
  meta: '38 ans · ♂ · Première consultation',
} as const;

/**
 * Reference ranges displayed on the right panel.
 * Verbatim from the prototype "Repères (H 30-50 ans)" panel.
 */
export const REFERENCE_RANGES: PreviousVitalEntry[] = [
  { label: 'TA',   value: '< 130 / 80', unit: '' },
  { label: 'FC',   value: '60 – 100',    unit: 'bpm' },
  { label: 'T°',   value: '36,1 – 37,2', unit: '°C' },
  { label: 'SpO₂', value: '≥ 95',        unit: '%' },
  { label: 'IMC',  value: '18,5 – 25',   unit: '' },
];

/** Default form values — verbatim from prototype display values. */
export const DEFAULT_VITALS = {
  tensionSys:   132,
  tensionDia:   84,
  pulse:        78,
  spo2:         98,
  tempC:        36.9,
  weightKg:     74,
  heightCm:     178,
  glycemia:     null,
  abdominalCm:  null,
  respRate:     null,
  notes: 'Patient vient pour première consultation. Se plaint de fatigue depuis 2 semaines, maux de tête le matin. Antécédents familiaux : père hypertendu.',
  jeun:     false,
  carnet:   true,
  analyses: false,
} as const;

/** Saisi-by footer line — verbatim from prototype. */
export const RECORDED_BY = 'Leila Berrada · Assistante · 09:47';
