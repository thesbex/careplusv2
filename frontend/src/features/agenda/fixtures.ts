/**
 * Mock data fixtures for the Agenda screen.
 * Lifted verbatim from design/prototype/screens/agenda.jsx:14–48 so the
 * visual parity auditor has a stable reference. When the backend scheduling
 * module ships (J4), `useAppointments` replaces these with real data.
 */
import type { Appointment, Arrival, WeekDay } from './types';

export const WEEK_DAYS: WeekDay[] = [
  { key: 'lun', label: 'Lundi', date: '21' },
  { key: 'mar', label: 'Mardi', date: '22' },
  { key: 'mer', label: 'Mercredi', date: '23' },
  { key: 'jeu', label: 'Jeudi', date: '24' },
  { key: 'ven', label: 'Vendredi', date: '25' },
  { key: 'sam', label: 'Samedi', date: '26' },
];

export const HOURS = Array.from({ length: 12 }, (_, i) => 8 + i); // 08..19

export const APPOINTMENTS: Appointment[] = [
  { day: 'lun', start: '09:00', dur: 15, patient: 'Mohamed Alami', reason: 'Consultation de suivi', allergy: 'Pénicilline', status: 'consult' },
  { day: 'lun', start: '09:30', dur: 20, patient: 'Fatima Zahra Lahlou', reason: 'Suivi grossesse 24 SA', status: 'confirmed' },
  { day: 'lun', start: '10:00', dur: 30, patient: 'Youssef Ziani', reason: 'Première consultation', status: 'vitals' },
  { day: 'lun', start: '11:00', dur: 20, patient: 'Samira Bennani', reason: 'Renouvellement ord.', status: 'done' },
  { day: 'lun', start: '14:30', dur: 30, patient: 'Omar Idrissi', reason: 'Bilan annuel', status: 'confirmed' },
  { day: 'lun', start: '16:00', dur: 15, patient: 'Nadia Fassi', reason: 'Résultats analyses', status: 'confirmed' },
  { day: 'mar', start: '09:15', dur: 20, patient: 'Karim Berrada', reason: 'Douleurs lombaires', status: 'confirmed' },
  { day: 'mar', start: '10:00', dur: 15, patient: 'Leila Chraibi', reason: 'Vaccination', status: 'confirmed' },
  { day: 'mar', start: '11:15', dur: 15, patient: 'Khadija Tahiri', reason: 'Contrôle diabète', status: 'confirmed' },
  { day: 'mar', start: '14:00', dur: 30, patient: 'Rachid Mansouri', reason: 'Première consultation', status: 'confirmed' },
  { day: 'mar', start: '15:30', dur: 15, patient: 'Amina Touhami', reason: 'Certificat médical', status: 'confirmed' },
  { day: 'mer', start: '08:30', dur: 30, patient: 'Hassan El Fassi', reason: 'Consultation', status: 'confirmed' },
  { day: 'mer', start: '11:00', dur: 20, patient: 'Zineb Ouazzani', reason: 'Suivi thyroïde', status: 'confirmed' },
  { day: 'mer', start: '15:00', dur: 15, patient: 'Ahmed Cherkaoui', reason: 'Suivi HTA', allergy: 'Aspirine', status: 'arrived' },
  { day: 'mer', start: '16:00', dur: 30, patient: 'Brahim Sqalli', reason: 'Première consultation', status: 'confirmed' },
  { day: 'jeu', start: '09:00', dur: 15, patient: 'Laila Bouhlal', reason: 'Contrôle tension', status: 'confirmed' },
  { day: 'jeu', start: '10:30', dur: 30, patient: 'Youness Alaoui', reason: 'Bilan sanguin', status: 'confirmed' },
  { day: 'jeu', start: '14:00', dur: 20, patient: 'Sanae Kettani', reason: 'Suivi grossesse 32 SA', status: 'confirmed' },
  { day: 'jeu', start: '15:00', dur: 15, patient: 'Driss Benkirane', reason: 'Renouvellement', status: 'confirmed' },
  { day: 'ven', start: '08:30', dur: 20, patient: 'Meriem Tazi', reason: 'Migraines', status: 'confirmed' },
  { day: 'ven', start: '10:00', dur: 15, patient: 'Abdellah Rami', reason: 'Contrôle', status: 'confirmed' },
  { day: 'ven', start: '11:00', dur: 30, patient: 'Houda Benslimane', reason: 'Première consultation', status: 'confirmed' },
  { day: 'ven', start: '15:30', dur: 15, patient: 'Saad Cherradi', reason: 'Résultats imagerie', status: 'confirmed' },
  { day: 'sam', start: '09:00', dur: 30, patient: 'Aicha Semlali', reason: 'Bilan annuel', status: 'confirmed' },
  { day: 'sam', start: '10:30', dur: 15, patient: 'Walid Kadiri', reason: 'Vaccination', status: 'confirmed' },
];

export const ARRIVALS: Arrival[] = [
  { name: 'Mohamed Alami', apt: '09:00', status: 'consult', since: '09:04', allergy: 'Pénicilline' },
  { name: 'Youssef Ziani', apt: '10:00', status: 'vitals', since: '09:51' },
  { name: 'Ahmed Cherkaoui', apt: '15:00', status: 'arrived', since: '—', allergy: 'Aspirine' },
];

/** Pixel scale used by the agenda grid (same constant as the prototype). */
export const ROW_PX = 72;

/** "hh:mm" → minutes from 08:00. */
export const toMin = (t: string): number => {
  const [h, m] = t.split(':').map(Number) as [number, number];
  return (h - 8) * 60 + m;
};

export const pxFromMin = (m: number): number => (m / 60) * ROW_PX;
