/**
 * Zod schemas for the Stock interne module.
 * Mirrors backend DTOs: RecordMovementRequest, UpsertArticleRequest, UpsertSupplierRequest.
 * exactOptionalPropertyTypes: true — use z.optional() rather than z.undefined().
 *
 * i18n (#122) : les messages de validation sont des CLÉS de traduction
 * (`stock.valid.*`), résolues au rendu via `t(errors.<champ>.message)` côté
 * composant. Cf. messages.stock.ts et le pattern grossesse/schemas.ts.
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
      .number({ invalid_type_error: 'stock.valid.qtyRequired' })
      .int('stock.valid.qtyInteger')
      .min(1, 'stock.valid.qtyPositive'),
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
          message: 'stock.valid.reasonRequired',
        });
      }
    }
    if (data.type === 'IN' && data._articleCategory === 'MEDICAMENT_INTERNE') {
      if (!data.lotNumber || data.lotNumber.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lotNumber'],
          message: 'stock.valid.lotRequired',
        });
      }
      if (!data.expiresOn || data.expiresOn.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['expiresOn'],
          message: 'stock.valid.expiryRequired',
        });
      }
    }
  });

export type MovementValues = z.infer<typeof MovementSchema>;

// ── Article schema ─────────────────────────────────────────────────────────

/**
 * Schema for creating/editing a stock article.
 *
 * Validation conditionnelle par catégorie (le formulaire rend également les
 * champs conditionnellement, mais c'est ici qu'on garde la source de vérité) :
 *  - DOSSIER_PHYSIQUE : seul `location` est obligatoire (en plus de label).
 *    `code` et `unit` sont auto-pré-remplis par le formulaire (`DOSS-XXXXXXXX`,
 *    `dossier`) — un dossier patient ne se réapprovisionne pas, n'a pas
 *    d'unité de mesure parlante et n'a pas de fournisseur.
 *  - MEDICAMENT_INTERNE / CONSOMMABLE : tous les champs (code, label, unit,
 *    threshold) restent obligatoires comme avant.
 */
export const UpsertArticleSchema = z
  .object({
    code: z
      .string()
      .min(1, 'stock.valid.codeRequired')
      .max(64)
      .toUpperCase(),
    label: z.string().min(1, 'stock.valid.labelRequired').max(200),
    category: z.enum(['MEDICAMENT_INTERNE', 'DOSSIER_PHYSIQUE', 'CONSOMMABLE'], {
      required_error: 'stock.valid.categoryRequired',
    }),
    unit: z.string().min(1, 'stock.valid.unitRequired').max(32),
    minThreshold: z
      .number({ invalid_type_error: 'stock.valid.thresholdRequired' })
      .int()
      .min(0, 'stock.valid.thresholdMin'),
    supplierId: z.preprocess(emptyToUndef, z.string().uuid().optional()),
    location: z.preprocess(emptyToUndef, z.string().max(200).optional()),
    active: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.category === 'DOSSIER_PHYSIQUE') {
      if (!data.location || data.location.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['location'],
          message: 'stock.valid.locationRequired',
        });
      }
    }
  });

export type UpsertArticleValues = z.infer<typeof UpsertArticleSchema>;

// ── Supplier schema ────────────────────────────────────────────────────────

/**
 * Schema for creating/editing a supplier.
 */
export const UpsertSupplierSchema = z.object({
  name: z.string().min(1, 'stock.valid.nameRequired').max(200),
  phone: z.preprocess(emptyToUndef, z.string().max(50).optional()),
  active: z.boolean(),
});

export type UpsertSupplierValues = z.infer<typeof UpsertSupplierSchema>;
