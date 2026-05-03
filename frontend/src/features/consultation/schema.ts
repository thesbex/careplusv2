/**
 * Zod schema for the Consultation SOAP form.
 * Mirrors the expected backend DTO (consultation module, J5 backend).
 * All four sections are required strings; `minLength(1)` is enforced only
 * on sign (the "Signer et verrouiller" action) — autosave is permissive.
 *
 * TODO(backend:J5): align with actual PUT /api/consultations/:id DTO once shipped.
 */
import { z } from 'zod';

export const consultationDraftSchema = z.object({
  subjectif: z.string(),
  objectif: z.string(),
  analyse: z.string(),
  plan: z.string(),
});

/** Stricter schema used at sign time — all four sections must be non-empty. */
export const consultationSignSchema = z.object({
  subjectif: z.string().min(1, 'Subjectif requis'),
  objectif: z.string().min(1, 'Objectif requis'),
  analyse: z.string().min(1, 'Analyse requise'),
  plan: z.string().min(1, 'Plan requis'),
});

export type ConsultationDraft = z.infer<typeof consultationDraftSchema>;
export type ConsultationSign = z.infer<typeof consultationSignSchema>;
