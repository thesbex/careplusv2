/**
 * MovementDrawer — desktop slide-over panel for recording a stock movement.
 * 3 modes: IN / OUT / ADJUSTMENT.
 * Opened from the article detail page via 3 quick-action buttons.
 */
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { MovementSchema } from '../schemas';
import type { MovementValues } from '../schemas';
import { useRecordMovement } from '../hooks/useRecordMovement';
import { useStockLots } from '../hooks/useStockLots';
import { toProblemDetail } from '@/lib/api/problemJson';
import type { StockArticleCategory, StockMovementType } from '../types';

interface MovementDrawerProps {
  articleId: string;
  articleCategory: StockArticleCategory;
  articleLabel: string;
  currentQuantity: number;
  mode: StockMovementType;
  open: boolean;
  onClose: () => void;
}

const MODE_LABEL_KEY: Record<StockMovementType, string> = {
  IN: 'stock.movement.in',
  OUT: 'stock.movement.out',
  ADJUSTMENT: 'stock.movement.adjustment',
};

const MODE_COLOR: Record<StockMovementType, string> = {
  IN: 'var(--status-arrived, #16a34a)',
  OUT: 'var(--amber, #d97706)',
  ADJUSTMENT: 'var(--primary)',
};

export function MovementDrawer({
  articleId,
  articleCategory,
  articleLabel,
  currentQuantity,
  mode,
  open,
  onClose,
}: MovementDrawerProps) {
  const { t } = useT();
  const modeLabel = t(MODE_LABEL_KEY[mode]);
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

  // Reset form when mode or open state changes
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
          ? t('stock.movement.toast.in')
          : mode === 'OUT'
          ? t('stock.movement.toast.out')
          : t('stock.movement.toast.adjustment'),
      );
      onClose();
    } catch (err) {
      const pd = toProblemDetail(err);
      if (pd?.type?.includes('INSUFFICIENT_STOCK')) {
        toast.error(t('stock.movement.err.insufficient'));
      } else if (pd?.type?.includes('LOT_REQUIRED')) {
        toast.error(t('stock.movement.err.lotRequired'));
      } else if (pd?.type?.includes('REASON_REQUIRED')) {
        toast.error(t('stock.movement.err.reasonRequired'));
      } else {
        toast.error(pd?.detail ?? t('stock.movement.err.generic'));
      }
    }
  }

  if (!open) return null;

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
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={modeLabel}
        style={{
          position: 'relative',
          width: 440,
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
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 650,
                color: MODE_COLOR[mode],
              }}
            >
              {modeLabel}
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {articleLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
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
            {t('stock.movement.availableStock')}{' '}
            <strong style={{ color: 'var(--ink)' }}>
              {currentQuantity}
            </strong>
          </div>

          {/* Quantity */}
          <div>
            <label
              htmlFor="mv-quantity"
              style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
            >
              {mode === 'ADJUSTMENT' ? t('stock.movement.quantityAdjust') : t('stock.movement.quantity')}
              {' *'}
            </label>
            <Input
              id="mv-quantity"
              type="number"
              min={1}
              {...register('quantity', { valueAsNumber: true })}
              aria-invalid={Boolean(errors.quantity)}
            />
            {errors.quantity && (
              <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                {t(errors.quantity.message ?? '')}
              </div>
            )}
            {isOverStock && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--amber, #d97706)',
                  marginTop: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {t('stock.movement.overStock', { n: currentQuantity })}
              </div>
            )}
          </div>

          {/* Lot fields — IN + medicament only */}
          {mode === 'IN' && isMedicament && (
            <>
              <div>
                <label
                  htmlFor="mv-lot"
                  style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
                >
                  {t('stock.movement.lotNumber')}
                </label>
                <Input
                  id="mv-lot"
                  list="mv-lot-list"
                  placeholder={t('stock.movement.lotPlaceholder')}
                  {...register('lotNumber')}
                  aria-invalid={Boolean(errors.lotNumber)}
                />
                {lots.length > 0 && (
                  <datalist id="mv-lot-list">
                    {lots.map((lot) => (
                      <option key={lot.id} value={lot.lotNumber} />
                    ))}
                  </datalist>
                )}
                {errors.lotNumber && (
                  <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                    {t(errors.lotNumber.message ?? '')}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="mv-expires"
                  style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
                >
                  {t('stock.movement.expiry')}
                </label>
                <Input
                  id="mv-expires"
                  type="date"
                  {...register('expiresOn')}
                  aria-invalid={Boolean(errors.expiresOn)}
                />
                {errors.expiresOn && (
                  <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                    {t(errors.expiresOn.message ?? '')}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Reason — ADJUSTMENT required, others optional */}
          {(mode === 'ADJUSTMENT') && (
            <div>
              <label
                htmlFor="mv-reason"
                style={{ display: 'block', fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: 'var(--ink-2)' }}
              >
                {t('stock.movement.reason')}
              </label>
              <textarea
                id="mv-reason"
                rows={3}
                placeholder={t('stock.movement.reasonPlaceholder')}
                {...register('reason')}
                aria-invalid={Boolean(errors.reason)}
                style={{
                  width: '100%',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  padding: '8px 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  color: 'var(--ink)',
                  background: 'var(--surface)',
                  boxSizing: 'border-box',
                }}
              />
              {errors.reason && (
                <div style={{ fontSize: 11.5, color: 'var(--danger)', marginTop: 4 }}>
                  {t(errors.reason.message ?? '')}
                </div>
              )}
            </div>
          )}

          {/* Submit */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || recordMutation.isPending}
            >
              {isSubmitting || recordMutation.isPending
                ? t('common.saving')
                : modeLabel}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
