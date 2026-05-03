/**
 * Zod schemas for the Vaccination module.
 * Mirrors backend DTOs: RecordDoseRequest, DeferDoseRequest, UpdateDoseRequest.
 * exactOptionalPropertyTypes: true — use z.optional() rather than z.undefined().
 */
import { z } from 'zod';

const routeEnum = z.enum(['IM', 'SC', 'PO', 'ID']);

/**
 * Schema for recording a new dose (POST /api/patients/:id/vaccinations).
 * lotNumber is required (backend enforces it — scenario 3 in IT).
 */
export const RecordDoseSchema = z.object({
  vaccineId: z.string().uuid('Vaccin requis'),
  doseNumber: z.number().int().min(1, 'Numéro de dose invalide'),
  scheduleDoseId: z.string().uuid().optional(),
  administeredAt: z
    .string()
    .min(1, 'Date / heure requise')
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Date invalide' }),
  lotNumber: z.string().min(1, 'Numéro de lot obligatoire').max(100),
  route: routeEnum.optional(),
  site: z.string().max(100).optional(),
  administeredBy: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
});

export type RecordDoseValues = z.infer<typeof RecordDoseSchema>;

/**
 * Schema for deferring a dose (POST /api/patients/:id/vaccinations/:doseId/defer).
 */
export const DeferDoseSchema = z.object({
  reason: z.string().min(1, 'Motif de report requis').max(500),
});

export type DeferDoseValues = z.infer<typeof DeferDoseSchema>;

/**
 * Schema for updating an existing administered dose (PUT).
 * version is required for optimistic locking.
 */
export const UpdateDoseSchema = z.object({
  vaccineId: z.string().uuid().optional().nullable(),
  doseNumber: z.number().int().min(1).optional().nullable(),
  administeredAt: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'Date invalide' })
    .optional()
    .nullable(),
  lotNumber: z.string().min(1, 'Numéro de lot obligatoire').max(100).optional().nullable(),
  route: routeEnum.optional().nullable(),
  site: z.string().max(100).optional().nullable(),
  administeredBy: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  version: z.number().int('Version requise'),
});

export type UpdateDoseValues = z.infer<typeof UpdateDoseSchema>;

// ── Paramétrage schemas ────────────────────────────────────────────────────────

/**
 * Schema for creating/editing a vaccine in the catalog.
 * code must be UPPERCASE alphanumeric, 2-32 chars.
 */
// HTML <select> sans valeur sélectionnée renvoie une chaîne vide ; on la
// normalise en undefined avant l'enum-check pour ne pas faire échouer la
// validation au submit.
const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

export const UpsertVaccineSchema = z.object({
  code: z
    .string()
    .min(2, 'Code requis (2 caractères minimum)')
    .max(32)
    .regex(/^[A-Z0-9_-]+$/, 'Code : lettres majuscules, chiffres, _ ou - uniquement'),
  nameFr: z.string().min(1, 'Nom requis').max(200),
  manufacturerDefault: z.preprocess(emptyToUndef, z.string().max(200).optional()),
  routeDefault: z.preprocess(emptyToUndef, z.enum(['IM', 'SC', 'PO', 'ID']).optional()),
  active: z.boolean(),
  isPni: z.boolean(),
});

export type UpsertVaccineValues = z.infer<typeof UpsertVaccineSchema>;

/**
 * Schema for creating/editing a scheduled dose.
 */
export const UpsertScheduleDoseSchema = z.object({
  vaccineId: z.string().uuid('Vaccin requis'),
  doseNumber: z.number().int().min(1, 'Numéro de dose requis (>= 1)'),
  targetAgeDays: z.number().int().min(0, 'Âge cible requis (>= 0)'),
  toleranceDays: z.number().int().min(0, 'Tolérance requise (>= 0)'),
  labelFr: z.string().min(1, 'Libellé requis').max(200),
});

export type UpsertScheduleDoseValues = z.infer<typeof UpsertScheduleDoseSchema>;
