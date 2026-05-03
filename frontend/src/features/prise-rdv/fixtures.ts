/**
 * Mock data for Prise de RDV.
 * Lifted verbatim from design/prototype/screens/prise-rdv.jsx and
 * design/prototype/mobile/screens.jsx:MPriseRDV so the visual parity auditor
 * has a stable reference.
 * When backend J4 ships, hooks replace these with real data.
 */
import type { PatientCandidate, ReasonOption, SlotOption } from './types';

/** Patient search suggestions — prototype value "Salma B" shows these 3. */
export const PATIENT_SUGGESTIONS: PatientCandidate[] = [
  {
    id: 'p-1',
    name: 'Salma Bennani',
    phone: '+212 6 61 23 45 67',
    lastVisit: '12/03/2026',
    tags: ['Patient connu'],
  },
  {
    id: 'p-2',
    name: 'Salma Benkirane',
    phone: '+212 6 12 98 76 54',
    lastVisit: '—',
    tags: ['Nouveau'],
  },
  {
    id: 'p-3',
    name: 'Salim Bouazzaoui',
    phone: '+212 6 55 14 22 08',
    lastVisit: '02/11/2025',
    tags: ['Patient connu'],
  },
];

/** Consultation reason options — prototype step 3 type buttons. */
export const REASON_OPTIONS: ReasonOption[] = [
  { id: 'premiere', label: 'Première consultation' },
  { id: 'suivi', label: 'Consultation de suivi' },
  { id: 'renouvellement', label: 'Renouvellement' },
  { id: 'resultats', label: 'Résultats' },
  { id: 'vaccination', label: 'Vaccination' },
  { id: 'certificat', label: 'Certificat' },
];

/** Available slots hint shown in the desktop dialog (step 2). */
export const AVAILABLE_SLOTS_HINT = '10:30 · 11:30 · 14:00 · 16:45';

/**
 * Available time slots for the mobile slot grid.
 * Lifted from design/prototype/mobile/screens.jsx:MPriseRDV:slots.
 */
export const MOBILE_SLOTS: SlotOption[] = [
  { time: '09:30', available: true },
  { time: '10:00', available: true },
  { time: '10:30', available: true },
  { time: '11:00', available: true },
  { time: '11:30', available: true },
  { time: '14:00', available: true },
  { time: '14:30', available: true },
  { time: '15:00', available: true },
  { time: '15:30', available: true },
  { time: '16:00', available: true },
];

/** Default duration options (desktop select). */
export const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '60 minutes' },
];
