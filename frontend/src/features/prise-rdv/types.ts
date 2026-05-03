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
  tags: string[];
}
