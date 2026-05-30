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

/**
 * Messages de bornes : encodés en clés i18n `vitals.err.min|max:<valeur>`.
 * Le composant qui rend l'erreur (PriseConstantesPage / VitalFieldLarge via
 * `translateVitalsError`) les traduit avec interpolation `{min}` / `{max}`.
 * Le zod schema ne peut pas appeler `useT()` (hors composant React).
 */
const minMsg = (n: number) => `vitals.err.min:${n}`;
const maxMsg = (n: number) => `vitals.err.max:${n}`;

export const vitalsFormSchema = z.object({
  /** Systolic blood pressure (mmHg). Wide bounds — match backend DTO. */
  tensionSys: z
    .number()
    .int()
    .min(20, minMsg(20))
    .max(300, maxMsg(300))
    .nullable()
    .optional(),

  /** Diastolic blood pressure (mmHg). */
  tensionDia: z
    .number()
    .int()
    .min(10, minMsg(10))
    .max(250, maxMsg(250))
    .nullable()
    .optional(),

  /** Heart rate in beats per minute. */
  pulse: z
    .number()
    .int()
    .min(10, minMsg(10))
    .max(300, maxMsg(300))
    .nullable()
    .optional(),

  /** Oxygen saturation (%). */
  spo2: z
    .number()
    .min(0, minMsg(0))
    .max(100, maxMsg(100))
    .nullable()
    .optional(),

  /** Body temperature in Celsius. */
  tempC: z
    .number()
    .min(20, minMsg(20))
    .max(46, maxMsg(46))
    .nullable()
    .optional(),

  /** Body weight in kilograms. */
  weightKg: z
    .number()
    .min(0.2, minMsg(0.2))
    .max(500, maxMsg(500))
    .nullable()
    .optional(),

  /** Height in centimetres. */
  heightCm: z
    .number()
    .int()
    .min(20, minMsg(20))
    .max(260, maxMsg(260))
    .nullable()
    .optional(),

  // ── Étape 2 — optional measures ───────────────────────────────────
  /** Blood glucose in g/L. */
  glycemia: z.number().min(0).max(30).nullable().optional(),

  /** Abdominal perimeter in cm. */
  abdominalCm: z.number().int().min(0).max(300).nullable().optional(),

  /** Respiratory rate per minute. */
  respRate: z.number().int().min(0).max(100).nullable().optional(),

  /**
   * Périmètre crânien (pédiatrie) en cm. Utile en suivi nourrisson.
   * Plage volontairement large : nourrisson 30 → adulte 65.
   */
  headCircumferenceCm: z.number().min(20).max(80).nullable().optional(),

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
      v.respRate != null ||
      v.headCircumferenceCm != null,
    { message: 'vitals.err.atLeastOne' },
  );

export type VitalsFormValues = z.infer<typeof vitalsFormSchema>;

/**
 * Traduit un message d'erreur du schema (clé i18n, éventuellement suffixée
 * `:valeur` pour les bornes min/max) via le `t()` du composant appelant.
 * Renvoie tel quel les messages déjà lisibles (sécurité fallback).
 */
export function translateVitalsError(
  message: string | undefined,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | undefined {
  if (!message) return message;
  if (message.startsWith('vitals.err.min:')) {
    return t('vitals.err.min', { min: message.slice('vitals.err.min:'.length) });
  }
  if (message.startsWith('vitals.err.max:')) {
    return t('vitals.err.max', { max: message.slice('vitals.err.max:'.length) });
  }
  if (message.startsWith('vitals.')) return t(message);
  return message;
}
