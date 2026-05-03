/**
 * MovementDrawer (mobile) — Vaul bottom-sheet variant.
 * Same logic as the desktop drawer, different presentation.
 */
import { useEffect } from 'react';
import { Drawer } from 'vaul';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { MovementSchema } from '../schemas';
import type { MovementValues } from '../schemas';
import { useRecordMovement } from '../hooks/useRecordMovement';
import { useStockLots } from '../hooks/useStockLots';
import { toProblemDetail } from '@/lib/api/problemJson';
import type { StockArticleCategory, StockMovementType } from '../types';

interface MovementDrawerMobileProps {
  articleId: string;
  articleCategory: StockArticleCategory;
  articleLabel: string;
  currentQuantity: number;
  mode: StockMovementType;
  open: boolean;
  onClose: () => void;
}

const MODE_LABEL: Record<StockMovementType, string> = {
  IN: 'Entrée de stock',
  OUT: 'Sortie de stock',
  ADJUSTMENT: 'Ajustement de stock',
};

const MODE_COLOR: Record<StockMovementType, string> = {
  IN: 'var(--status-arrived, #16a34a)',
  OUT: 'var(--amber, #d97706)',
  ADJUSTMENT: 'var(--primary)',
};

export function MovementDrawerMobile({
  articleId,
  articleCategory,
  articleLabel,
  currentQuantity,
  mode,
  open,
  onClose,
}: MovementDrawerMobileProps) {
  const isMedicament = articleCategory === 'MEDICAMENT_INTERNE';
  const { lots } = useStockLots(isMedicament ? articleId : undefined, 'ACTIVE');
  const recordMutation = useRecordMovement(articleId);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<MovementValues>({
    resolver: zodResolver(MovementSchema),
    defaultValues: {
      type: mode,
      quantity: 1,
      reason: '',
      lotNumber: '',
      expiresOn: '',
      _articleCategory: articleCategory,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        type: mode,
        quantity: 1,
        reason: '',
        lotNumber: '',
        expiresOn: '',
        _articleCategory: articleCategory,
      });
    }
  }, [open, mode, articleCategory, reset]);

  const watchedQty = watch('quantity');
  const isOverStock = mode === 'OUT' && typeof watchedQty === 'number' && watchedQty > currentQuantity;

  async function onSubmit(values: MovementValues) {
    try {
      const body: {
        type: StockMovementType;
        quantity: number;
        reason?: string;
        lotNumber?: string;
        expiresOn?: string;
      } = {
        type: values.type,
        quantity: values.quantity,
      };
      if (values.reason && values.reason.trim().length > 0) {
        body.reason = values.reason.trim();
      }
      if (values.lotNumber && values.lotNumber.trim().length > 0) {
        body.lotNumber = values.lotNumber.trim();
      }
      if (values.expiresOn && values.expiresOn.trim().length > 0) {
        body.expiresOn = values.expiresOn.trim();
      }
      await recordMutation.mutateAsync(body);
      toast.success(
        mode === 'IN'
          ? 'Entrée enregistrée'
          : mode === 'OUT'
          ? 'Sortie enregistrée'
          : 'Ajustement enregistré',
      );
      onClose();
    } catch (err) {
      const pd = toProblemDetail(err);
      if (pd?.type?.includes('INSUFFICIENT_STOCK')) {
        toast.error('Stock insuffisant pour cette sortie');
      } else if (pd?.type?.includes('LOT_REQUIRED')) {
        toast.error('Numéro de lot obligatoire pour ce médicament');
      } else if (pd?.type?.includes('REASON_REQUIRED')) {
        toast.error("Motif obligatoire pour l'ajustement");
      } else {
        toast.error(pd?.detail ?? "Impossible d'enregistrer le mouvement");
      }
    }
  }

  return (
    <Drawer.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Drawer.Portal>
        <Drawer.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 40,
          }}
        />
        <Drawer.Content
          aria-label={MODE_LABEL[mode]}
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--surface)',
            borderRadius: 'var(--r-lg, 16px) var(--r-lg, 16px) 0 0',
            maxHeight: '90dvh',
            overflowY: 'auto',
          }}
        >
          {/* Drag handle */}
          <div
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              background: 'var(--border)',
              margin: '12px auto 0',
            }}
          />

          <div style={{ padding: '16px 20px 8px' }}>
            <div style={{ fontSize: 14, fontWeight: 650, color: MODE_COLOR[mode] }}>
              {MODE_LABEL[mode]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {articleLabel}
            </div>
          </div>

          <form
            onSubmit={(e) => void handleSubmit(onSubmit)(e)}
            style={{
              padding: '12px 20px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Stock info */}
            <div
              style={{
                padding: '10px 14px',
                background: 'var(--surface-2)',
                borderRadius: 'var(--r-md)',
                fontSize: 13,
                color: 'var(--ink-2)',
              }}
            >
              Stock disponible :{' '}
              <strong style={{ color: 'var(--ink)' }}>{currentQuantity}</strong>
            </div>

            {/* Quantity */}
            <div>
              <label
                htmlFor="mv-m-quantity"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
              >
                Quantité{mode === 'ADJUSTMENT' ? ' (nouvelle quantité totale)' : ''} *
              </label>
              <input
                id="mv-m-quantity"
                type="number"
                min={1}
                {...register('quantity', { valueAsNumber: true })}
                aria-invalid={Boolean(errors.quantity)}
                style={{
                  width: '100%',
                  height: 44,
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '0 12px',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                }}
              />
              {errors.quantity && (
                <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                  {errors.quantity.message}
                </div>
              )}
              {isOverStock && (
                <div style={{ fontSize: 12, color: 'var(--amber, #d97706)', marginTop: 4 }}>
                  Attention : quantité supérieure au stock ({currentQuantity})
                </div>
              )}
            </div>

            {/* Lot fields — IN + medicament only */}
            {mode === 'IN' && isMedicament && (
              <>
                <div>
                  <label
                    htmlFor="mv-m-lot"
                    style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
                  >
                    Numéro de lot *
                  </label>
                  <input
                    id="mv-m-lot"
                    list="mv-m-lot-list"
                    placeholder="ex. L2024-001"
                    {...register('lotNumber')}
                    aria-invalid={Boolean(errors.lotNumber)}
                    style={{
                      width: '100%',
                      height: 44,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      padding: '0 12px',
                      fontSize: 16,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      color: 'var(--ink)',
                      background: 'var(--surface)',
                    }}
                  />
                  {lots.length > 0 && (
                    <datalist id="mv-m-lot-list">
                      {lots.map((lot) => (
                        <option key={lot.id} value={lot.lotNumber} />
                      ))}
                    </datalist>
                  )}
                  {errors.lotNumber && (
                    <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.lotNumber.message}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="mv-m-expires"
                    style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
                  >
                    Date de péremption *
                  </label>
                  <input
                    id="mv-m-expires"
                    type="date"
                    {...register('expiresOn')}
                    aria-invalid={Boolean(errors.expiresOn)}
                    style={{
                      width: '100%',
                      height: 44,
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      padding: '0 12px',
                      fontSize: 16,
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                      color: 'var(--ink)',
                      background: 'var(--surface)',
                    }}
                  />
                  {errors.expiresOn && (
                    <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                      {errors.expiresOn.message}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Reason — ADJUSTMENT required */}
            {mode === 'ADJUSTMENT' && (
              <div>
                <label
                  htmlFor="mv-m-reason"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
                >
                  Motif *
                </label>
                <textarea
                  id="mv-m-reason"
                  rows={3}
                  placeholder="Inventaire mensuel, correction erreur de saisie…"
                  {...register('reason')}
                  aria-invalid={Boolean(errors.reason)}
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    padding: '10px 12px',
                    fontSize: 16,
                    fontFamily: 'inherit',
                    resize: 'none',
                    color: 'var(--ink)',
                    background: 'var(--surface)',
                    boxSizing: 'border-box',
                  }}
                />
                {errors.reason && (
                  <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                    {errors.reason.message}
                  </div>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || recordMutation.isPending}
              style={{
                width: '100%',
                height: 48,
                border: 'none',
                borderRadius: 'var(--r-md)',
                background: 'var(--primary)',
                color: 'white',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: isSubmitting || recordMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: isSubmitting || recordMutation.isPending ? 0.7 : 1,
              }}
            >
              {isSubmitting || recordMutation.isPending ? 'Enregistrement…' : MODE_LABEL[mode]}
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '100%',
                height: 44,
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                background: 'transparent',
                color: 'var(--ink-2)',
                fontSize: 15,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
