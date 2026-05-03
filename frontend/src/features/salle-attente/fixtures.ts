/**
 * Mock fixtures for the Salle d'attente screen.
 * Lifted verbatim from design/prototype/screens/salle-attente.jsx and
 * design/prototype/mobile/screens.jsx (MSalle block).
 *
 * When the J5 backend (check-in + queue + vitals) ships, useQueue.ts
 * will replace these with real data via GET /api/queue.
 */
import type { QueueEntry, QueueKpi, UpcomingPatient } from './types';

/** Active queue — patients who have arrived. Verbatim from prototype. */
export const QUEUE: QueueEntry[] = [
  {
    name: 'Mohamed Alami',
    apt: '09:00',
    arrived: '08:54',
    status: 'consult',
    waited: '—',
    room: 'Box 1',
    allergy: 'Pénicilline',
    age: 52,
    reason: 'Consultation de suivi',
  },
  {
    name: 'Fatima Z. Lahlou',
    apt: '09:30',
    arrived: '09:22',
    status: 'waiting',
    waited: '25 min',
    room: '—',
    age: 29,
    reason: 'Suivi grossesse 24 SA',
  },
  {
    name: 'Youssef Ziani',
    apt: '10:00',
    arrived: '09:41',
    status: 'vitals',
    waited: '6 min',
    room: 'Constantes',
    age: 38,
    reason: 'Première consultation',
  },
  {
    name: 'Ahmed Cherkaoui',
    apt: '15:00',
    arrived: '09:46',
    status: 'arrived',
    waited: '1 min',
    room: '—',
    allergy: 'Aspirine',
    age: 61,
    reason: 'Suivi HTA',
  },
];

/** KPI tiles row — verbatim from prototype. */
export const KPIS: QueueKpi[] = [
  { label: 'Arrivés',          value: '4',  sub: '2 en avance' },
  { label: 'Attente moyenne',  value: '11', unit: 'min', sub: 'Objectif ≤ 15 min' },
  { label: 'En consultation',  value: '1',  sub: 'Dr. El Amrani · Box 1' },
  { label: 'Retards',          value: '0',  sub: 'Aucun' },
];

/** Patients expected but not yet arrived — verbatim from prototype. */
export const UPCOMING: UpcomingPatient[] = [
  { name: 'Samira Bennani', time: '11:00', eta: 'dans 1h 13min' },
  { name: 'Omar Idrissi',   time: '14:30', eta: 'cet après-midi' },
  { name: 'Nadia Fassi',    time: '16:00', eta: 'cet après-midi' },
];
