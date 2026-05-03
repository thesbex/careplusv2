/**
 * Zod schemas for the Stock interne module.
 * Mirrors backend DTOs: RecordMovementRequest, UpsertArticleRequest, UpsertSupplierRequest.
 * exactOptionalPropertyTypes: true — use z.optional() rather than z.undefined().
 */
import { z } from 'zod';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Normalise empty string from HTML select to undefined */
const emptyToUndef = (v: unknown) => (v === '' ? undefined : v);

// ── Movement schema ────────────────────────────────────────────────────────

/**
 * Schema for recording a stock movement (POST /api/stock/articles/:id/movements).
 * - reason is required when type = ADJUSTMENT
 * - lotNumber + expiresOn are required when type = IN on MEDICAMENT_INTERNE
 *   (the articleCategory is passed as context via superRefine)
 */
export const MovementSchema = z
  .object({
    type: z.enum(['IN', 'OUT', 'ADJUSTMENT']),
    quantity: z
      .number({ invalid_type_error: 'Quantité requise' })
      .int('La quantité doit être un entier')
      .min(1, 'La quantité doit être > 0'),
    reason: z.string().max(500).optional(),
    lotNumber: z.string().max(100).optional(),
    expiresOn: z.string().optional(), // ISO date "YYYY-MM-DD"
    /** Passed from form context, not sent to backend */
    _articleCategory: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'ADJUSTMENT') {
      if (!data.reason || data.reason.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: 'Motif obligatoire pour un ajustement',
        });
      }
    }
    if (data.type === 'IN' && data._articleCategory === 'MEDICAMENT_INTERNE') {
      if (!data.lotNumber || data.lotNumber.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lotNumber'],
          message: 'Numéro de lot obligatoire pour un médicament',
        });
      }
      if (!data.expiresOn || data.expiresOn.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiresOn'],
          message: 'Date de péremption obligatoire pour un médicament',
        });
      }
    }
  });

export type MovementValues = z.infer<typeof MovementSchema>;

// ── Article schema ─────────────────────────────────────────────────────────

/**
 * Schema for creating/editing a stock article.
 */
export const UpsertArticleSchema = z.object({
  code: z
    .string()
    .min(1, 'Code requis')
    .max(64)
    .toUpperCase(),
  label: z.string().min(1, 'Libellé requis').max(200),
  category: z.enum(['MEDICAMENT_INTERNE', 'DOSSIER_PHYSIQUE', 'CONSOMMABLE'], {
    required_error: 'Catégorie requise',
  }),
  unit: z.string().min(1, 'Unité requise').max(32),
  minThreshold: z
    .number({ invalid_type_error: 'Seuil requis' })
    .int()
    .min(0, 'Seuil >= 0'),
  supplierId: z.preprocess(emptyToUndef, z.string().uuid().optional()),
  location: z.preprocess(emptyToUndef, z.string().max(200).optional()),
  active: z.boolean(),
});

export type UpsertArticleValues = z.infer<typeof UpsertArticleSchema>;

// ── Supplier schema ────────────────────────────────────────────────────────

/**
 * Schema for creating/editing a supplier.
 */
export const UpsertSupplierSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(200),
  phone: z.preprocess(emptyToUndef, z.string().max(50).optional()),
  active: z.boolean(),
});

export type UpsertSupplierValues = z.infer<typeof UpsertSupplierSchema>;
