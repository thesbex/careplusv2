/**
 * StockArticleFormDrawer — slide-over for creating/editing a stock article.
 * Used from the articles list ("Ajouter") and from the article detail ("Éditer").
 */
import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { UpsertArticleSchema } from '../schemas';
import type { UpsertArticleValues } from '../schemas';
import { useUpsertArticle } from '../hooks/useUpsertArticle';
import { useStockSuppliers } from '../hooks/useStockSuppliers';
import { toProblemDetail } from '@/lib/api/problemJson';
import type { StockArticle } from '../types';

interface StockArticleFormDrawerProps {
  mode: 'create' | 'edit';
  article?: StockArticle | undefined;
  open: boolean;
  onClose: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'MEDICAMENT_INTERNE', label: 'Médicament' },
  { value: 'DOSSIER_PHYSIQUE', label: 'Dossier physique' },
  { value: 'CONSOMMABLE', label: 'Consommable' },
] as const;

export function StockArticleFormDrawer({
  mode,
  article,
  open,
  onClose,
}: StockArticleFormDrawerProps) {
  const { suppliers } = useStockSuppliers();
  const upsert = useUpsertArticle(mode);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<UpsertArticleValues>({
    resolver: zodResolver(UpsertArticleSchema),
    defaultValues: {
      code: '',
      label: '',
      category: 'CONSOMMABLE',
      unit: '',
      minThreshold: 0,
      supplierId: undefined,
      location: undefined,
      active: true,
    },
  });

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && article) {
        reset({
          code: article.code,
          label: article.label,
          category: article.category,
          unit: article.unit,
          minThreshold: article.minThreshold,
          ...(article.supplierId ? { supplierId: article.supplierId } : {}),
          ...(article.location ? { location: article.location } : {}),
          active: article.active,
        });
      } else {
        reset({
          code: '',
          label: '',
          category: 'CONSOMMABLE',
          unit: '',
          minThreshold: 0,
          supplierId: undefined,
          location: undefined,
          active: true,
        });
      }
    }
  }, [open, mode, article, reset]);

  async function onSubmit(values: UpsertArticleValues) {
    try {
      const body = {
        code: values.code,
        label: values.label,
        category: values.category,
        unit: values.unit,
        minThreshold: values.minThreshold,
        active: values.active,
        ...(values.supplierId ? { supplierId: values.supplierId } : {}),
        ...(values.location ? { location: values.location } : {}),
      };
      await upsert.mutateAsync({ ...(article?.id ? { id: article.id } : {}), body });
      toast.success(mode === 'create' ? 'Article créé' : 'Article modifié');
      onClose();
    } catch (err) {
      const pd = toProblemDetail(err);
      if (pd?.type?.includes('CODE_DUPLICATE')) {
        toast.error('Ce code article existe déjà');
      } else if (pd?.type?.includes('CATEGORY_LOCKED')) {
        toast.error('La catégorie ne peut pas être modifiée après des mouvements');
      } else {
        toast.error(pd?.detail ?? "Impossible d'enregistrer l'article");
      }
    }
  }

  if (!open) return null;

  const title = mode === 'create' ? 'Ajouter un article' : "Modifier l'article";

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: 'relative',
          width: 480,
          height: '100%',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.12)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 650, color: 'var(--ink)' }}>{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-3)',
              padding: 4,
            }}
          >
            <Close />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={(e) => void handleSubmit(onSubmit)(e)}
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Code */}
          <div>
            <label
              htmlFor="art-code"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              Code article *
            </label>
            <Input
              id="art-code"
              placeholder="ex. BETADINE-125"
              readOnly={mode === 'edit'}
              {...register('code')}
              aria-invalid={Boolean(errors.code)}
              style={mode === 'edit' ? { background: 'var(--surface-2)', color: 'var(--ink-3)' } : {}}
            />
            {errors.code && (
              <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                {errors.code.message}
              </div>
            )}
          </div>

          {/* Label */}
          <div>
            <label
              htmlFor="art-label"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              Libellé *
            </label>
            <Input
              id="art-label"
              placeholder="ex. Bétadine 10% flacon 125 mL"
              {...register('label')}
              aria-invalid={Boolean(errors.label)}
            />
            {errors.label && (
              <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                {errors.label.message}
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label
              htmlFor="art-category"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              Catégorie *
            </label>
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <select
                  id="art-category"
                  {...field}
                  disabled={mode === 'edit'}
                  aria-invalid={Boolean(errors.category)}
                  style={{
                    width: '100%',
                    height: 36,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '0 10px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: mode === 'edit' ? 'var(--surface-2)' : 'var(--surface)',
                    color: mode === 'edit' ? 'var(--ink-3)' : 'var(--ink)',
                  }}
                >
                  {CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.category && (
              <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                {errors.category.message}
              </div>
            )}
          </div>

          {/* Unit */}
          <div>
            <label
              htmlFor="art-unit"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              Unité *
            </label>
            <Input
              id="art-unit"
              placeholder="ex. flacon, boîte, unité, mL"
              {...register('unit')}
              aria-invalid={Boolean(errors.unit)}
            />
            {errors.unit && (
              <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                {errors.unit.message}
              </div>
            )}
          </div>

          {/* Min threshold */}
          <div>
            <label
              htmlFor="art-threshold"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              Seuil d&apos;alerte stock faible
            </label>
            <Input
              id="art-threshold"
              type="number"
              min={0}
              {...register('minThreshold', { valueAsNumber: true })}
              aria-invalid={Boolean(errors.minThreshold)}
            />
            {errors.minThreshold && (
              <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                {errors.minThreshold.message}
              </div>
            )}
          </div>

          {/* Supplier */}
          <div>
            <label
              htmlFor="art-supplier"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              Fournisseur
            </label>
            <Controller
              control={control}
              name="supplierId"
              render={({ field }) => (
                <select
                  id="art-supplier"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || undefined)}
                  style={{
                    width: '100%',
                    height: 36,
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '0 10px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    background: 'var(--surface)',
                    color: 'var(--ink)',
                  }}
                >
                  <option value="">— Aucun fournisseur —</option>
                  {suppliers
                    .filter((s) => s.active)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              )}
            />
          </div>

          {/* Location */}
          <div>
            <label
              htmlFor="art-location"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              Emplacement
            </label>
            <Input
              id="art-location"
              placeholder="ex. Armoire 1, tiroir B"
              {...register('location')}
            />
          </div>

          {/* Active */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              id="art-active"
              type="checkbox"
              {...register('active')}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label
              htmlFor="art-active"
              style={{ fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}
            >
              Article actif
            </label>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || upsert.isPending}
            >
              {isSubmitting || upsert.isPending
                ? 'Enregistrement…'
                : mode === 'create'
                ? 'Ajouter'
                : 'Enregistrer'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
