/**
 * Local types for the Prise de RDV feature.
 * Derived from schema.ts (zod infer) — do not hand-edit to drift from the schema.
 */
import type { z } from 'zod';
import type { rdvFormSchema, reasonOptionSchema, slotOptionSchema } from './schema';

export type RdvFormValues = z.infer<typeof rdvFormSchema>;

export type ReasonOption = z.infer<typeof reasonOptionSchema>;

export type SlotOption = z.infer<typeof slotOptionSchema>;

/** A patient search candidate returned by GET /api/patients?q=... */
export interface PatientCandidate {
  id: string;
  name: string;
  phone: string;
  lastVisit: string;
  /** Literal display tags (e.g. fixture badges). Localized labels such as the
   *  age are carried via `ageYears` and formatted at render time with t(). */
  tags: string[];
  /** Age in years, or null when the birthdate is unknown. Rendered via
   *  t('rdv.years', { n }) so the unit is localized (#122). */
  ageYears?: number | null;
}
