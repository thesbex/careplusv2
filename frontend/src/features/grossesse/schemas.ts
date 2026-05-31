/**
 * Zod schemas for the Grossesse module.
 * Aligned on OMS 2016 thresholds — see docs/plans/2026-05-03-grossesse-design.md.
 * exactOptionalPropertyTypes: true → use .optional() rather than nullable for unset.
 *
 * i18n (#122) : zod runs at module load, before any React context, so messages
 * here are stored as i18n KEY strings (`gross.valid.*`). The form components
 * resolve them at render time via `t(errors.<field>.message)`.
 */
import { z } from 'zod';
import { toLocalDate } from './types';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Today as YYYY-MM-DD using local components (avoid UTC drift, see feedback_local_date_iso.md). */
function today(): string {
  return toLocalDate(new Date());
}

const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;

const isoDate = z
  .string()
  .min(1, 'gross.valid.dateRequired')
  .regex(dateOnlyRegex, 'gross.valid.dateFormat');

const isoDateNotInFuture = isoDate.refine(
  (v) => v <= today(),
  'gross.valid.dateFuture',
);

// ── Declare ─────────────────────────────────────────────────────────────────

export const DeclarePregnancySchema = z.object({
  lmpDate: isoDateNotInFuture,
  notes: z.string().max(2000).optional(),
});
export type DeclarePregnancyValues = z.infer<typeof DeclarePregnancySchema>;

// ── Close ──────────────────────────────────────────────────────────────────

const outcomeEnum = z.enum([
  'ACCOUCHEMENT_VIVANT',
  'MORT_NEE',
  'MFIU',
  'FCS',
  'IVG',
  'GEU',
  'MOLE',
]);

export const ClosePregnancySchema = z.object({
  endedAt: isoDate,
  outcome: outcomeEnum,
  notes: z.string().max(2000).optional(),
});
export type ClosePregnancyValues = z.infer<typeof ClosePregnancySchema>;

// ── Create child ───────────────────────────────────────────────────────────

export const CreateChildSchema = z.object({
  firstName: z
    .string()
    .min(1, 'gross.valid.firstNameRequired')
    .max(80)
    .regex(/^[a-zA-ZÀ-ÿ؀-ۿ\s'-]{1,}$/, 'gross.valid.firstNameInvalid'),
  sex: z.enum(['M', 'F'], { required_error: 'gross.valid.sexRequired' }),
});
export type CreateChildValues = z.infer<typeof CreateChildSchema>;

// ── Visit (biométrie obstétricale) ─────────────────────────────────────────

const presentationEnum = z.enum(['CEPHALIQUE', 'SIEGE', 'TRANSVERSE', 'INDETERMINEE']);

export const UrineDipSchema = z.object({
  glucose: z.boolean(),
  protein: z.boolean(),
  leuco: z.boolean(),
  nitrites: z.boolean(),
  ketones: z.boolean(),
  blood: z.boolean(),
});

/**
 * Visit schema. Ranges follow OMS 2016 + design doc:
 * - TA syst 60..220, diast 30..140
 * - poids 30..180
 * - BCF 100..200
 * - HU 5..50
 */
export const RecordVisitSchema = z.object({
  recordedAt: z
    .string()
    .min(1, 'gross.valid.dateTimeRequired')
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'gross.valid.dateInvalid' }),
  weightKg: z
    .number({ invalid_type_error: 'gross.valid.weightInvalid' })
    .min(30, 'gross.valid.weightRange')
    .max(180, 'gross.valid.weightRange')
    .optional(),
  bpSystolic: z
    .number({ invalid_type_error: 'gross.valid.taInvalid' })
    .min(60, 'gross.valid.taSysRange')
    .max(220, 'gross.valid.taSysRange')
    .optional(),
  bpDiastolic: z
    .number({ invalid_type_error: 'gross.valid.taInvalid' })
    .min(30, 'gross.valid.taDiaRange')
    .max(140, 'gross.valid.taDiaRange')
    .optional(),
  urineDip: UrineDipSchema.optional(),
  fundalHeightCm: z
    .number({ invalid_type_error: 'gross.valid.huInvalid' })
    .min(5, 'gross.valid.huRange')
    .max(50, 'gross.valid.huRange')
    .optional(),
  fetalHeartRateBpm: z
    .number({ invalid_type_error: 'gross.valid.bcfInvalid' })
    .min(100, 'gross.valid.bcfRange')
    .max(200, 'gross.valid.bcfRange')
    .optional(),
  fetalMovementsPerceived: z.boolean().optional(),
  presentation: presentationEnum.optional(),
  notes: z.string().max(2000).optional(),
});
export type RecordVisitValues = z.infer<typeof RecordVisitSchema>;

// ── Ultrasound ─────────────────────────────────────────────────────────────

const kindEnum = z.enum(['T1_DATATION', 'T2_MORPHO', 'T3_CROISSANCE', 'AUTRE']);

/**
 * Mesure numérique facultative tolérante aux champs vides : un
 * `<input type="number">` vide produit `NaN` (via react-hook-form
 * `valueAsNumber`), que `z.number()` rejette. On mappe NaN / '' / null →
 * undefined avant la validation.
 */
const optionalMeasure = z.preprocess(
  (v) =>
    v === '' || v === null || (typeof v === 'number' && Number.isNaN(v))
      ? undefined
      : v,
  z.number().optional(),
);

export const RecordUltrasoundSchema = z.object({
  kind: kindEnum,
  performedAt: isoDate,
  saWeeksAtExam: z
    .number({ invalid_type_error: 'gross.valid.saWeeksRequired' })
    .int()
    .min(6, 'gross.valid.saRange')
    .max(44, 'gross.valid.saRange'),
  saDaysAtExam: z
    .number({ invalid_type_error: 'gross.valid.saDaysRequired' })
    .int()
    .min(0, 'gross.valid.saDaysRange')
    .max(6, 'gross.valid.saDaysRange'),
  findings: z.string().max(4000).optional(),
  biometry: z
    .object({
      // Champs de biométrie facultatifs. Les <input type="number"> vides
      // renvoient NaN via `valueAsNumber` ; z.number() rejette NaN, ce qui
      // bloquait silencieusement l'enregistrement tant que les 6 champs
      // n'étaient pas tous remplis. On normalise NaN/'' → undefined.
      bip: optionalMeasure,
      pc: optionalMeasure,
      dat: optionalMeasure,
      lf: optionalMeasure,
      eg: optionalMeasure,
      percentile: optionalMeasure,
    })
    .optional(),
  correctsDueDate: z.boolean(),
  documentId: z.string().uuid().optional(),
});
export type RecordUltrasoundValues = z.infer<typeof RecordUltrasoundSchema>;
