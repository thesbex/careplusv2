/**
 * Local types for the Salle d'attente screen (screen 04).
 * Derived from the prototype fixture shapes in:
 *   design/prototype/screens/salle-attente.jsx
 *   design/prototype/mobile/screens.jsx (MSalle block)
 */

/** Patient status in the waiting-room flow. */
export type WaitingPatientStatus = 'arrived' | 'waiting' | 'vitals' | 'consult' | 'done';

/** One entry in the active queue (patient who has arrived). */
export interface QueueEntry {
  /** Appointment id (used for check-in, vitals, consultation start). */
  appointmentId?: string;
  /** Patient id (used to start consultation). */
  patientId?: string;
  name: string;
  /** Scheduled appointment time "HH:MM". */
  apt: string;
  /** Actual arrival time "HH:MM". */
  arrived: string;
  status: WaitingPatientStatus;
  /** Display string e.g. "6 min" or "25 min" or "—". */
  waited: string;
  /** Room or station label, "—" if none. */
  room: string;
  /** Allergy name, if any. */
  allergy?: string;
  /** Patient age. */
  age: number;
  /** Visit reason / motif. */
  reason: string;
  /** Practitioner display name (Dr. xxx). */
  practitionerName?: string | null;
  /** Slot duration in minutes (from start_at..end_at). */
  durationMinutes?: number | null;
  /** Whether the patient is on the PREMIUM tier (renders 🌟). */
  isPremium?: boolean;
}

/** An upcoming appointment — not yet arrived. */
export interface UpcomingPatient {
  name: string;
  /** Scheduled time "HH:MM". */
  time: string;
  /** Human-readable ETA, e.g. "dans 1h 13min" or "cet après-midi". */
  eta: string;
}

/** KPI tile data for the top stat grid. */
export interface QueueKpi {
  label: string;
  value: string;
  unit?: string;
  sub: string;
}
