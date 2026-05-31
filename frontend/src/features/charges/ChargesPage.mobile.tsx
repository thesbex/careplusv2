/**
 * QA9-15 — Charges (dépenses) — mobile. ADMIN uniquement.
 * Liste de cartes + feuille d'ajout/édition (parité création / édition / suppression
 * avec le desktop). Récapitulatif annuel compact en tête.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/I18nProvider';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Select } from '@/components/ui/Input';
import {
  useExpenses,
  useExpenseSummary,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from './hooks/useExpenses';
import {
  CATEGORY_ORDER,
  PERIODICITY_ORDER,
  formatMad,
  type ExpenseResponse,
  type ExpenseCategory,
  type ExpensePeriodicity,
  type ExpenseRequest,
} from './types';

interface FormState {
  category: ExpenseCategory;
  label: string;
  amount: string;
  expenseDate: string;
  periodicity: ExpensePeriodicity;
  supplier: string;
  notes: string;
}

function todayLocal(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

const EMPTY_FORM: FormState = {
  category: 'AUTRE',
  label: '',
  amount: '',
  expenseDate: todayLocal(),
  periodicity: 'PONCTUELLE',
  supplier: '',
  notes: '',
};

export default function ChargesMobilePage() {
  const { t } = useT();
  const catLabel = (c: ExpenseCategory) => t(`charges.cat.${c}`);
  const perLabel = (p: ExpensePeriodicity) => t(`charges.per.${p}`);
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const { expenses, isLoading } = useExpenses(
    categoryFilter ? { category: categoryFilter } : {},
  );
  const year = new Date().getFullYear();
  const { summary } = useExpenseSummary(year);

  const { createExpense, isPending: creating } = useCreateExpense();
  const { updateExpense, isPending: updating } = useUpdateExpense();
  const { deleteExpense } = useDeleteExpense();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const yearTotal = useMemo(() => summary.reduce((acc, m) => acc + m.total, 0), [summary]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, expenseDate: todayLocal() });
    setSheetOpen(true);
  }
  function openEdit(e: ExpenseResponse) {
    setEditingId(e.id);
    setForm({
      category: e.category,
      label: e.label,
      amount: String(e.amount),
      expenseDate: e.expenseDate,
      periodicity: e.periodicity,
      supplier: e.supplier ?? '',
      notes: e.notes ?? '',
    });
    setSheetOpen(true);
  }

  async function handleSave() {
    if (!form.label.trim()) {
      toast.error(t('charges.err.labelRequired'));
      return;
    }
    const amount = Number(form.amount);
    if (!form.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      toast.error(t('charges.err.amountPositive'));
      return;
    }
    if (!form.expenseDate) {
      toast.error(t('charges.err.dateRequired'));
      return;
    }
    const body: ExpenseRequest = {
      category: form.category,
      label: form.label.trim(),
      amount,
      expenseDate: form.expenseDate,
      periodicity: form.periodicity,
      ...(form.supplier.trim() ? { supplier: form.supplier.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };
    try {
      if (editingId) {
        await updateExpense({ id: editingId, body });
        toast.success(t('charges.toast.updated'));
      } else {
        await createExpense(body);
        toast.success(t('charges.toast.added'));
      }
      setSheetOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      toast.error(
        e.response?.status === 403
          ? t('charges.err.forbidden')
          : t('charges.err.saveFailed'),
      );
    }
  }

  async function handleDelete(e: ExpenseResponse) {
    if (!confirm(t('charges.confirmDelete', { label: e.label }))) return;
    try {
      await deleteExpense(e.id);
      toast.success(t('charges.toast.deleted'));
    } catch {
      toast.error(t('charges.err.deleteFailed'));
    }
  }

  return (
    <MScreen
      tab="menu"
      noTabs
      onTabChange={() => undefined}
      topbar={
        <MTopbar
          left={
            <MIconBtn icon="ChevronLeft" label={t('charges.back')} onClick={() => navigate('/parametres')} />
          }
          title={t('charges.title')}
          sub={t('charges.count', { n: expenses.length, s: expenses.length > 1 ? 's' : '' })}
          right={
            <MIconBtn icon="Plus" label={t('charges.add')} onClick={openCreate} />
          }
        />
      }
    >
      <div className="mb-pad">
        {/* Récap annuel compact */}
        <div
          style={{
            marginBottom: 14, padding: 12,
            background: 'var(--bg-alt)', borderRadius: 'var(--r-lg)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('charges.totalYear', { year })}</span>
          <span style={{ fontSize: 15, fontWeight: 700 }} className="tnum">{formatMad(yearTotal)}</span>
        </div>

        {/* Filtre catégorie */}
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}
          className="m-input"
          aria-label={t('charges.filter.byCategoryAria')}
          style={{ marginBottom: 14 }}
        >
          <option value="">{t('charges.filter.allCategories')}</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{catLabel(c)}</option>
          ))}
        </Select>

        {/* Liste */}
        <div className="m-card">
          {isLoading ? (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
              {t('charges.loading')}
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              {t('charges.empty')}
            </div>
          ) : (
            expenses.map((e) => (
              <button
                key={e.id}
                type="button"
                className="m-row"
                onClick={() => openEdit(e)}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 0, font: 'inherit', fontFamily: 'inherit', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div className="m-row-pri">
                  <div className="m-row-main">{e.label}</div>
                  <div className="m-row-sub">
                    {catLabel(e.category)} · {perLabel(e.periodicity)} ·{' '}
                    <span className="tnum">{e.expenseDate}</span>
                    {e.supplier ? ` · ${e.supplier}` : ''}
                  </div>
                </div>
                <span className="tnum" style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                  {formatMad(e.amount)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {sheetOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(20,18,12,0.45)',
            display: 'flex', alignItems: 'flex-end',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setSheetOpen(false); }}
        >
          <div
            style={{
              width: '100%', maxHeight: '90vh',
              background: 'var(--surface)',
              borderTopLeftRadius: 16, borderTopRightRadius: 16,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 650, margin: 0, flex: 1 }}>
                {editingId ? t('charges.editTitle') : t('charges.newTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-3)' }}
                aria-label={t('charges.close')}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
              <MField label={t('charges.form.category')}>
                <Select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                  className="m-input"
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>{catLabel(c)}</option>
                  ))}
                </Select>
              </MField>
              <MField label={t('charges.form.label')}>
                <input
                  type="text"
                  className="m-input"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder={t('charges.form.labelPlaceholder')}
                />
              </MField>
              <MField label={t('charges.form.amount')}>
                <input
                  type="text"
                  inputMode="decimal"
                  className="m-input"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder={t('charges.form.amountPlaceholder')}
                />
              </MField>
              <MField label={t('charges.form.date')}>
                <input
                  type="date"
                  className="m-input"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                />
              </MField>
              <MField label={t('charges.form.periodicity')}>
                <Select
                  value={form.periodicity}
                  onChange={(e) => setForm({ ...form, periodicity: e.target.value as ExpensePeriodicity })}
                  className="m-input"
                >
                  {PERIODICITY_ORDER.map((p) => (
                    <option key={p} value={p}>{perLabel(p)}</option>
                  ))}
                </Select>
              </MField>
              <MField label={t('charges.form.supplier')}>
                <input
                  type="text"
                  className="m-input"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder={t('charges.form.supplierPlaceholder')}
                />
              </MField>
              <MField label={t('charges.form.notes')}>
                <textarea
                  className="m-input"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder={t('charges.form.notesPlaceholder')}
                  style={{ resize: 'vertical' }}
                />
              </MField>
            </div>
            <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    const target = expenses.find((x) => x.id === editingId);
                    if (target) { setSheetOpen(false); void handleDelete(target); }
                  }}
                  style={{
                    flex: '0 0 auto', padding: '10px 14px',
                    background: 'var(--danger-soft)', color: 'var(--danger)',
                    border: 0, borderRadius: 8, fontFamily: 'inherit', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {t('charges.form.delete')}
                </button>
              )}
              <button
                type="button"
                disabled={creating || updating}
                onClick={() => { void handleSave(); }}
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'var(--primary)', color: 'white',
                  border: 0, borderRadius: 8, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                {editingId ? t('charges.form.save') : t('charges.form.create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </MScreen>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}
