/**
 * Zod schema for the Prise des constantes form (screen 05).
 * Mirrors the backend DTO fields expected for
 * POST /api/appointments/:appointmentId/vitals (J5).
 *
 * All ranges are clinically realistic and match the reference panel
 * shown in the prototype ("Repères H 30-50 ans").
 */
import { z } from 'zod';

export const vitalsFormSchema = z.object({
  /** Systolic blood pressure (mmHg). */
  tensionSys: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(60, 'Valeur minimale : 60')
    .max(300, 'Valeur maximale : 300'),

  /** Diastolic blood pressure (mmHg). */
  tensionDia: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(30, 'Valeur minimale : 30')
    .max(200, 'Valeur maximale : 200'),

  /** Heart rate in beats per minute. */
  pulse: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(20, 'Valeur minimale : 20')
    .max(300, 'Valeur maximale : 300'),

  /** Oxygen saturation (%). */
  spo2: z
    .number({ invalid_type_error: 'Valeur requise' })
    .min(50, 'Valeur minimale : 50')
    .max(100, 'Valeur maximale : 100'),

  /** Body temperature in Celsius. */
  tempC: z
    .number({ invalid_type_error: 'Valeur requise' })
    .min(30, 'Valeur minimale : 30')
    .max(45, 'Valeur maximale : 45'),

  /** Body weight in kilograms. */
  weightKg: z
    .number({ invalid_type_error: 'Valeur requise' })
    .min(1, 'Valeur minimale : 1')
    .max(500, 'Valeur maximale : 500'),

  /** Height in centimetres. */
  heightCm: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(30, 'Valeur minimale : 30')
    .max(300, 'Valeur maximale : 300'),

  // ── Étape 2 — optional measures ───────────────────────────────────
  /** Blood glucose in g/L. */
  glycemia: z.number().min(0).max(30).nullable().optional(),

  /** Abdominal perimeter in cm. */
  abdominalCm: z.number().int().min(0).max(300).nullable().optional(),

  /** Respiratory rate per minute. */
  respRate: z.number().int().min(0).max(100).nullable().optional(),

  // ── Étape 3 — context ─────────────────────────────────────────────
  /** Chief complaint declared by patient. */
  notes: z.string().max(2000).optional(),

  /** Patient is fasting. */
  jeun: z.boolean(),

  /** Health booklet brought. */
  carnet: z.boolean(),

  /** Lab results brought. */
  analyses: z.boolean(),
});

export type VitalsFormValues = z.infer<typeof vitalsFormSchema>;
