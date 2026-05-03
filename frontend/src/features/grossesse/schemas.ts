/**
 * Zod schemas for the Grossesse module.
 * Aligned on OMS 2016 thresholds — see docs/plans/2026-05-03-grossesse-design.md.
 * exactOptionalPropertyTypes: true → use .optional() rather than nullable for unset.
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
  .min(1, 'Date requise')
  .regex(dateOnlyRegex, 'Format YYYY-MM-DD attendu');

const isoDateNotInFuture = isoDate.refine(
  (v) => v <= today(),
  'La date ne peut pas être dans le futur',
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
    .min(1, 'Prénom requis')
    .max(80)
    .regex(/^[a-zA-ZÀ-ÿ؀-ۿ\s'-]{1,}$/, 'Prénom invalide'),
  sex: z.enum(['M', 'F'], { required_error: 'Sexe requis' }),
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
    .min(1, 'Date / heure requise')
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Date invalide' }),
  weightKg: z
    .number({ invalid_type_error: 'Poids invalide' })
    .min(30, 'Poids hors plage (30-180 kg)')
    .max(180, 'Poids hors plage (30-180 kg)')
    .optional(),
  bpSystolic: z
    .number({ invalid_type_error: 'TA invalide' })
    .min(60, 'TA systolique hors plage (60-220)')
    .max(220, 'TA systolique hors plage (60-220)')
    .optional(),
  bpDiastolic: z
    .number({ invalid_type_error: 'TA invalide' })
    .min(30, 'TA diastolique hors plage (30-140)')
    .max(140, 'TA diastolique hors plage (30-140)')
    .optional(),
  urineDip: UrineDipSchema.optional(),
  fundalHeightCm: z
    .number({ invalid_type_error: 'HU invalide' })
    .min(5, 'HU hors plage (5-50 cm)')
    .max(50, 'HU hors plage (5-50 cm)')
    .optional(),
  fetalHeartRateBpm: z
    .number({ invalid_type_error: 'BCF invalide' })
    .min(100, 'BCF hors plage (100-200 bpm)')
    .max(200, 'BCF hors plage (100-200 bpm)')
    .optional(),
  fetalMovementsPerceived: z.boolean().optional(),
  presentation: presentationEnum.optional(),
  notes: z.string().max(2000).optional(),
});
export type RecordVisitValues = z.infer<typeof RecordVisitSchema>;

// ── Ultrasound ─────────────────────────────────────────────────────────────

const kindEnum = z.enum(['T1_DATATION', 'T2_MORPHO', 'T3_CROISSANCE', 'AUTRE']);

export const RecordUltrasoundSchema = z.object({
  kind: kindEnum,
  performedAt: isoDate,
  saWeeksAtExam: z
    .number({ invalid_type_error: 'SA semaines requis' })
    .int()
    .min(4, 'SA hors plage (4-44)')
    .max(44, 'SA hors plage (4-44)'),
  saDaysAtExam: z
    .number({ invalid_type_error: 'SA jours requis' })
    .int()
    .min(0, 'SA jours 0-6')
    .max(6, 'SA jours 0-6'),
  findings: z.string().max(4000).optional(),
  biometry: z
    .object({
      bip: z.number().optional(),
      pc: z.number().optional(),
      dat: z.number().optional(),
      lf: z.number().optional(),
      eg: z.number().optional(),
      percentile: z.number().optional(),
    })
    .optional(),
  correctsDueDate: z.boolean(),
  documentId: z.string().uuid().optional(),
});
export type RecordUltrasoundValues = z.infer<typeof RecordUltrasoundSchema>;
