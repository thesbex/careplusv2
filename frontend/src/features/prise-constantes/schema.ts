/**
 * Zod schema for the Prise des constantes form (screen 05).
 * Mirrors the backend DTO fields expected for
 * POST /api/appointments/:appointmentId/vitals (J5).
 *
 * Toutes les constantes sont individuellement optionnelles : un assistant
 * peut très bien ne saisir que la TA et le poids. Le backend (RecordVitalsRequest)
 * accepte chaque champ comme `null`. Une garde finale impose qu'au moins une
 * mesure soit présente — sinon il n'y a rien à enregistrer.
 *
 * Les bornes restent appliquées dès qu'une valeur est saisie pour rejeter
 * les fautes de frappe.
 */
import { z } from 'zod';

export const vitalsFormSchema = z.object({
  /** Systolic blood pressure (mmHg). Wide bounds — match backend DTO. */
  tensionSys: z
    .number()
    .int()
    .min(20, 'Valeur minimale : 20')
    .max(300, 'Valeur maximale : 300')
    .nullable()
    .optional(),

  /** Diastolic blood pressure (mmHg). */
  tensionDia: z
    .number()
    .int()
    .min(10, 'Valeur minimale : 10')
    .max(250, 'Valeur maximale : 250')
    .nullable()
    .optional(),

  /** Heart rate in beats per minute. */
  pulse: z
    .number()
    .int()
    .min(10, 'Valeur minimale : 10')
    .max(300, 'Valeur maximale : 300')
    .nullable()
    .optional(),

  /** Oxygen saturation (%). */
  spo2: z
    .number()
    .min(0, 'Valeur minimale : 0')
    .max(100, 'Valeur maximale : 100')
    .nullable()
    .optional(),

  /** Body temperature in Celsius. */
  tempC: z
    .number()
    .min(20, 'Valeur minimale : 20')
    .max(46, 'Valeur maximale : 46')
    .nullable()
    .optional(),

  /** Body weight in kilograms. */
  weightKg: z
    .number()
    .min(0.2, 'Valeur minimale : 0,2')
    .max(500, 'Valeur maximale : 500')
    .nullable()
    .optional(),

  /** Height in centimetres. */
  heightCm: z
    .number()
    .int()
    .min(20, 'Valeur minimale : 20')
    .max(260, 'Valeur maximale : 260')
    .nullable()
    .optional(),

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
})
  .refine(
    (v) =>
      v.tensionSys != null ||
      v.tensionDia != null ||
      v.pulse != null ||
      v.spo2 != null ||
      v.tempC != null ||
      v.weightKg != null ||
      v.heightCm != null ||
      v.glycemia != null ||
      v.abdominalCm != null ||
      v.respRate != null,
    { message: 'Renseignez au moins une constante.' },
  );

export type VitalsFormValues = z.infer<typeof vitalsFormSchema>;
