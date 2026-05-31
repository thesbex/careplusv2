/**
 * LotInactivateDialog — confirmation dialog before marking a lot INACTIVE.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { useInactivateLot } from '../hooks/useInactivateLot';
import { useT } from '@/lib/i18n/I18nProvider';

interface LotInactivateDialogProps {
  articleId: string;
  lotId: string;
  lotNumber: string;
  open: boolean;
  onClose: () => void;
}

export function LotInactivateDialog({
  articleId,
  lotId,
  lotNumber,
  open,
  onClose,
}: LotInactivateDialogProps) {
  const { t } = useT();
  const { inactivate, isPending } = useInactivateLot(articleId);
  const [confirming, setConfirming] = useState(false);

  async function handleConfirm() {
    setConfirming(true);
    try {
      await inactivate(lotId);
      toast.success(t('stock.lotDialog.toast.success', { lot: lotNumber }));
      onClose();
    } catch {
      toast.error(t('stock.lotDialog.toast.error'));
    } finally {
      setConfirming(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Backdrop */}
      <div
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="lot-inact-title"
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: 'var(--r-lg)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          padding: '24px',
          width: 400,
          maxWidth: 'calc(100vw - 32px)',
        }}
      >
        <h2
          id="lot-inact-title"
          style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}
        >
          {t('stock.lotDialog.title')}
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55 }}>
          {t('stock.lotDialog.bodyPrefix')}{' '}
          <strong style={{ color: 'var(--ink)' }}>{lotNumber}</strong>
          {t('stock.lotDialog.bodySuffix')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending || confirming}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => void handleConfirm()}
            disabled={isPending || confirming}
          >
            {isPending || confirming ? t('stock.lotDialog.inactivating') : t('stock.lotDialog.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
