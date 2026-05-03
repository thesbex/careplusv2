/**
 * Zod schema for the Prise de RDV form.
 * Mirrors the backend DTO fields expected for POST /api/appointments (J4).
 * Format JJ/MM/AAAA and HH:MM strings match the prototype copy verbatim.
 */
import { z } from 'zod';

export const reasonOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
});

export const slotOptionSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
  available: z.boolean(),
});

export const rdvFormSchema = z.object({
  /** Selected patient id — null means none chosen yet. */
  patientId: z.string().nullable(),
  /** Patient search query (not submitted — drives the search UI). */
  patientQuery: z.string(),
  /** "JJ/MM/AAAA" */
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Format JJ/MM/AAAA requis'),
  /** "HH:MM" */
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM requis'),
  durationMin: z.number().int().min(5).max(120),
  reasonId: z.string().nullable(),
  notes: z.string().optional(),
  sendSms: z.boolean(),
});
