/**
 * Onglet "Stock" dans ParametragePage.
 * Section unique — Fournisseurs (CRUD nom + téléphone).
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Edit, Trash } from '@/components/icons';
import { useStockSuppliers } from '../hooks/useStockSuppliers';
import { useUpsertSupplier, type UpsertSupplierBody } from '../hooks/useUpsertSupplier';
import { useDeactivateSupplier } from '../hooks/useDeactivateSupplier';
import { UpsertSupplierSchema } from '../schemas';
import type { UpsertSupplierValues } from '../schemas';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useT } from '@/lib/i18n/I18nProvider';
import type { StockSupplier } from '../types';

// ── Supplier form drawer ──────────────────────────────────────────────────────

interface SupplierFormDrawerProps {
  mode: 'create' | 'edit';
  initial?: StockSupplier;
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_SUPPLIER: UpsertSupplierValues = {
  name: '',
  phone: undefined,
  active: true,
};

function SupplierFormDrawer({ mode, initial, onClose, onSaved }: SupplierFormDrawerProps) {
  const { t } = useT();
  const mutation = useUpsertSupplier(mode);

  const defaultValues: UpsertSupplierValues =
    mode === 'edit' && initial
      ? {
          name: initial.name,
          phone: initial.phone ?? undefined,
          active: initial.active,
        }
      : EMPTY_SUPPLIER;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpsertSupplierValues>({
    resolver: zodResolver(UpsertSupplierSchema),
    defaultValues,
  });

  async function onSubmit(values: UpsertSupplierValues) {
    const body: UpsertSupplierBody = {
      name: values.name,
      active: values.active,
      ...(values.phone !== undefined && values.phone !== '' ? { phone: values.phone } : {}),
    };
    try {
      await mutation.mutateAsync(initial?.id ? { id: initial.id, body } : { body });
      toast.success(mode === 'create' ? t('stock.suppliers.toast.added') : t('stock.suppliers.toast.updated'));
      onSaved();
    } catch (err) {
      const problem = toProblemDetail(err);
      if (problem.violations?.length) {
        toast.error(problem.violations.map((v) => `${v.field} : ${v.message}`).join(' · '));
      } else {
        toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
      }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.25)',
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-label={mode === 'create' ? t('stock.suppliers.addTitle') : t('stock.suppliers.editTitle')}
        style={{
          position: 'relative',
          width: 400,
          height: '100%',
          background: 'var(--surface)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.10)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {mode === 'create' ? t('stock.suppliers.addTitle') : t('stock.suppliers.editTitle')}
        </div>

        <form
          id="supplier-form"
          onSubmit={(e) => {
            void handleSubmit(onSubmit)(e);
          }}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <Field>
            <FieldLabel htmlFor="sup-name">{t('stock.suppliers.name')}</FieldLabel>
            <Input
              id="sup-name"
              placeholder={t('stock.suppliers.namePlaceholder')}
              {...register('name')}
            />
            {errors.name && (
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>
                {t(errors.name.message ?? '')}
              </div>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="sup-phone">{t('stock.suppliers.phone')}</FieldLabel>
            <Input
              id="sup-phone"
              placeholder={t('stock.suppliers.phonePlaceholder')}
              {...register('phone')}
            />
          </Field>

          {mode === 'edit' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="sup-active"
                {...register('active')}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="sup-active" style={{ fontSize: 13, cursor: 'pointer' }}>
                {t('stock.suppliers.activeLabel')}
              </label>
            </div>
          )}
        </form>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            gap: 8,
          }}
        >
          <Button
            type="submit"
            form="supplier-form"
            variant="primary"
            disabled={mutation.isPending}
            style={{ flex: 1 }}
          >
            {mutation.isPending
              ? t('common.saving')
              : mode === 'create'
                ? t('stock.suppliers.submitAdd')
                : t('stock.suppliers.submitSave')}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Deactivate confirm dialog ─────────────────────────────────────────────────

function DeactivateConfirmDialog({
  supplier,
  onConfirm,
  onCancel,
  isPending,
}: {
  supplier: StockSupplier;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useT();
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        role="dialog"
        aria-label={t('stock.suppliers.deactivateTitle')}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--r-md)',
          padding: '24px',
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>
          {t('stock.suppliers.deactivateQuestion')}
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 20, lineHeight: 1.5 }}>
          <strong>{supplier.name}</strong>{t('stock.suppliers.deactivateBodySuffix')}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={isPending}
            onClick={onConfirm}
            style={{ background: 'var(--danger)', border: 'none' }}
          >
            {isPending ? t('stock.suppliers.deactivating') : t('stock.suppliers.deactivate')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Fournisseurs section ──────────────────────────────────────────────────────

function FournisseursSection() {
  const { t } = useT();
  const { suppliers, isLoading, error } = useStockSuppliers();
  const { deactivate, isPending: isDeactivating } = useDeactivateSupplier();
  const [showDrawer, setShowDrawer] = useState(false);
  const [editTarget, setEditTarget] = useState<StockSupplier | undefined>(undefined);
  const [deactivateTarget, setDeactivateTarget] = useState<StockSupplier | null>(null);

  function openCreate() {
    setEditTarget(undefined);
    setShowDrawer(true);
  }

  function openEdit(s: StockSupplier) {
    setEditTarget(s);
    setShowDrawer(true);
  }

  function closeDrawer() {
    setShowDrawer(false);
    setEditTarget(undefined);
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    await deactivate(deactivateTarget.id).catch(() => null);
    setDeactivateTarget(null);
  }

  return (
    <>
      <Panel>
        <PanelHeader>
          <span>{t('stock.suppliers.title')}</span>
          <Button
            size="sm"
            variant="primary"
            style={{ marginLeft: 'auto' }}
            onClick={openCreate}
          >
            {t('stock.suppliers.add')}
          </Button>
        </PanelHeader>
        <div style={{ overflowX: 'auto' }}>
          {isLoading && (
            <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 12 }}>{t('common.loading')}</div>
          )}
          {error && (
            <div style={{ padding: 16, color: 'var(--danger)', fontSize: 12 }}>{error}</div>
          )}
          {!isLoading && !error && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {[
                    t('stock.suppliers.col.name'),
                    t('stock.suppliers.col.phone'),
                    t('stock.suppliers.col.active'),
                    t('stock.suppliers.col.actions'),
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid var(--border)',
                        textAlign: 'left',
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: 'var(--ink-3)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {suppliers.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: '24px 12px',
                        color: 'var(--ink-3)',
                        fontSize: 13,
                        textAlign: 'center',
                      }}
                    >
                      {t('stock.suppliers.empty')}
                    </td>
                  </tr>
                )}
                {suppliers.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      opacity: s.active ? 1 : 0.55,
                    }}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: 550 }}>{s.name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--ink-3)' }}>
                      {s.phone ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="checkbox"
                        checked={s.active}
                        readOnly
                        aria-label={t('stock.suppliers.activeAria', { name: s.name })}
                        style={{ width: 16, height: 16, cursor: 'default' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          aria-label={t('stock.suppliers.editAria', { name: s.name })}
                          onClick={() => openEdit(s)}
                        >
                          <Edit />
                        </Button>
                        {s.active && (
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            aria-label={t('stock.suppliers.deactivateAria', { name: s.name })}
                            disabled={isDeactivating}
                            onClick={() => setDeactivateTarget(s)}
                          >
                            <Trash />
                          </Button>
                        )}
                        {!s.active && (
                          <span style={{ fontSize: 11, color: 'var(--ink-3)', padding: '4px 8px' }}>
                            {t('stock.suppliers.deactivated')}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      {showDrawer && (
        <SupplierFormDrawer
          mode={editTarget ? 'edit' : 'create'}
          {...(editTarget ? { initial: editTarget } : {})}
          onClose={closeDrawer}
          onSaved={closeDrawer}
        />
      )}

      {deactivateTarget && (
        <DeactivateConfirmDialog
          supplier={deactivateTarget}
          onConfirm={() => void confirmDeactivate()}
          onCancel={() => setDeactivateTarget(null)}
          isPending={isDeactivating}
        />
      )}
    </>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────

export function StockParamTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <FournisseursSection />
    </div>
  );
}
