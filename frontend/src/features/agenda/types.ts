export type DayKey = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam';

export type AppointmentStatus = 'confirmed' | 'arrived' | 'vitals' | 'consult' | 'done';

export interface WeekDay {
  key: DayKey;
  label: string;
  date: string;
}

export interface Appointment {
  /** Backend id — present when loaded from API, absent for fixtures. */
  id?: string;
  /** Backend patient id — present when loaded from API. */
  patientId?: string;
  /** ISO start datetime. */
  startAt?: string;
  /** Duration in minutes. */
  durationMinutes?: number;
  day: DayKey;
  /** "HH:MM" 24h. */
  start: string;
  /** Duration in minutes (UI). */
  dur: number;
  patient: string;
  reason: string;
  status: AppointmentStatus;
  allergy?: string;
  /** Backend status name (PLANIFIE / CONFIRME / ARRIVE / ...). */
  rawStatus?: string;
}

export interface Arrival {
  name: string;
  /** "HH:MM" — scheduled appointment time. */
  apt: string;
  status: Extract<AppointmentStatus, 'arrived' | 'vitals' | 'consult'>;
  since: string;
  allergy?: string;
}
