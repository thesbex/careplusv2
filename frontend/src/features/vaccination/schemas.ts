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
