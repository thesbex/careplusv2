export type DayKey = 'lun' | 'mar' | 'mer' | 'jeu' | 'ven' | 'sam';

export type AppointmentStatus = 'confirmed' | 'arrived' | 'vitals' | 'consult' | 'done';

export interface WeekDay {
  key: DayKey;
  label: string;
  date: string;
}

export interface Appointment {
  day: DayKey;
  /** "HH:MM" 24h. */
  start: string;
  /** Duration in minutes. */
  dur: number;
  patient: string;
  reason: string;
  status: AppointmentStatus;
  allergy?: string;
}

export interface Arrival {
  name: string;
  /** "HH:MM" — scheduled appointment time. */
  apt: string;
  status: Extract<AppointmentStatus, 'arrived' | 'vitals' | 'consult'>;
  since: string;
  allergy?: string;
}
