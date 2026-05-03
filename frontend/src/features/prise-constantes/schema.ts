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
  /** Systolic blood pressure (mmHg). Wide bounds — match backend DTO. */
  tensionSys: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(20, 'Valeur minimale : 20')
    .max(300, 'Valeur maximale : 300'),

  /** Diastolic blood pressure (mmHg). */
  tensionDia: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(10, 'Valeur minimale : 10')
    .max(250, 'Valeur maximale : 250'),

  /** Heart rate in beats per minute. */
  pulse: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(10, 'Valeur minimale : 10')
    .max(300, 'Valeur maximale : 300'),

  /** Oxygen saturation (%). */
  spo2: z
    .number({ invalid_type_error: 'Valeur requise' })
    .min(0, 'Valeur minimale : 0')
    .max(100, 'Valeur maximale : 100'),

  /** Body temperature in Celsius. */
  tempC: z
    .number({ invalid_type_error: 'Valeur requise' })
    .min(20, 'Valeur minimale : 20')
    .max(46, 'Valeur maximale : 46'),

  /** Body weight in kilograms. */
  weightKg: z
    .number({ invalid_type_error: 'Valeur requise' })
    .min(0.2, 'Valeur minimale : 0,2')
    .max(500, 'Valeur maximale : 500'),

  /** Height in centimetres. */
  heightCm: z
    .number({ invalid_type_error: 'Valeur requise' })
    .int()
    .min(20, 'Valeur minimale : 20')
    .max(260, 'Valeur maximale : 260'),

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
