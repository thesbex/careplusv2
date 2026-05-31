/**
 * QA9-15 — Screen « Charges » (dépenses du cabinet). ADMIN uniquement.
 *
 * - Tableau des charges (date, catégorie FR, libellé, montant MAD, périodicité, fournisseur).
 * - Tiroir « Ajouter une charge » (catégorie, libellé, montant, date, périodicité, fournisseur, notes).
 * - Édition par ligne, suppression avec confirmation (soft-delete).
 * - Récapitulatif mensuel de l'année courante via /api/expenses/summary.
 * - Filtre par catégorie optionnel.
 *
 * Endpoints (V057 backend) :
 *   GET /api/expenses?category=&from=&to=  · POST/PUT/DELETE /api/expenses · GET /api/expenses/summary?year=
 */
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/I18nProvider';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Input';
import { Plus, Trash, Invoice as InvoiceIcon } from '@/components/icons';
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

/** Date du jour en YYYY-MM-DD à partir des composantes LOCALES (pas toISOString → UTC). */
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

export default function ChargesPage() {
  const { t } = useT();
  const catLabel = (c: ExpenseCategory) => t(`charges.cat.${c}`);
  const perLabel = (p: ExpensePeriodicity) => t(`charges.per.${p}`);
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | ''>('');
  const [periodicityFilter, setPeriodicityFilter] = useState<ExpensePeriodicity | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');

  // Filtres serveur (catégorie + plage de dates) — le backend supporte déjà.
  const serverFilters = useMemo(() => {
    const f: { category?: ExpenseCategory; from?: string; to?: string } = {};
    if (categoryFilter) f.category = categoryFilter;
    if (fromDate) f.from = fromDate;
    if (toDate) f.to = toDate;
    return f;
  }, [categoryFilter, fromDate, toDate]);

  const { expenses: rawExpenses, isLoading } = useExpenses(serverFilters);
  const year = new Date().getFullYear();
  const { summary } = useExpenseSummary(year);

  // Filtres client (périodicité / montant / fournisseur — pas besoin d'un round-trip).
  const expenses = useMemo(() => {
    let out = rawExpenses;
    if (periodicityFilter) out = out.filter((e) => e.periodicity === periodicityFilter);
    if (amountMin) {
      const min = parseFloat(amountMin);
      if (!Number.isNaN(min)) out = out.filter((e) => e.amount >= min);
    }
    if (amountMax) {
      const max = parseFloat(amountMax);
      if (!Number.isNaN(max)) out = out.filter((e) => e.amount <= max);
    }
    if (supplierSearch.trim()) {
      const needle = supplierSearch.trim().toLowerCase();
      out = out.filter(
        (e) =>
          (e.supplier ?? '').toLowerCase().includes(needle) ||
          (e.label ?? '').toLowerCase().includes(needle),
      );
    }
    return out;
  }, [rawExpenses, periodicityFilter, amountMin, amountMax, supplierSearch]);

  const hasActiveFilter =
    !!categoryFilter ||
    !!periodicityFilter ||
    !!fromDate ||
    !!toDate ||
    !!amountMin ||
    !!amountMax ||
    !!supplierSearch.trim();

  function resetFilters() {
    setCategoryFilter('');
    setPeriodicityFilter('');
    setFromDate('');
    setToDate('');
    setAmountMin('');
    setAmountMax('');
    setSupplierSearch('');
  }

  /** Génère un CSV des charges actuellement filtrées + déclenche le download. */
  function exportCsv() {
    const headers = [
      t('charges.csv.date'),
      t('charges.csv.category'),
      t('charges.csv.label'),
      t('charges.csv.amount'),
      t('charges.csv.periodicity'),
      t('charges.csv.supplier'),
      t('charges.csv.notes'),
    ];
    const rows = expenses.map((e) => [
      e.expenseDate,
      catLabel(e.category),
      e.label,
      String(e.amount),
      perLabel(e.periodicity),
      e.supplier ?? '',
      (e.notes ?? '').replace(/\s+/g, ' '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `charges-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const { createExpense, isPending: creating } = useCreateExpense();
  const { updateExpense, isPending: updating } = useUpdateExpense();
  const { deleteExpense } = useDeleteExpense();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const yearTotal = useMemo(
    () => summary.reduce((acc, m) => acc + m.total, 0),
    [summary],
  );
  const maxMonth = useMemo(
    () => summary.reduce((mx, m) => Math.max(mx, m.total), 0),
    [summary],
  );
  const byMonth = useMemo(() => {
    const m = new Map<number, number>();
    for (const row of summary) m.set(row.month, row.total);
    return m;
  }, [summary]);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, expenseDate: todayLocal() });
    setDrawerOpen(true);
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
    setDrawerOpen(true);
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
    // exactOptionalPropertyTypes: n'inclure supplier/notes que s'ils sont définis.
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
      setDrawerOpen(false);
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
    <Screen
      active="charges"
      title={t('charges.title')}
      sub={t('charges.count', { n: expenses.length, s: expenses.length > 1 ? 's' : '' })}
      topbarRight={
        <>
          <Button
            type="button"
            onClick={exportCsv}
            disabled={expenses.length === 0}
            title={expenses.length === 0 ? t('charges.exportNothing') : t('charges.exportHint')}
          >
            <InvoiceIcon /> {t('charges.exportCsv')}
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <Plus /> {t('charges.add')}
          </Button>
        </>
      }
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Récapitulatif annuel */}
        <Panel style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 13, fontWeight: 650, margin: 0 }}>
              {t('charges.recap', { year })}
            </h2>
            <div style={{ fontSize: 14, fontWeight: 700 }} className="tnum">
              {t('charges.yearTotal', { year, amount: formatMad(yearTotal) })}
            </div>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gap: 8,
              alignItems: 'end',
              height: 96,
            }}
            aria-label={t('charges.monthlyTotalsAria')}
          >
            {Array.from({ length: 12 }, (_, idx) => {
              const month = idx + 1;
              const lbl = t(`charges.month.${month}`);
              const total = byMonth.get(month) ?? 0;
              const h = maxMonth > 0 ? Math.round((total / maxMonth) * 72) : 0;
              return (
                <div
                  key={month}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}
                  title={t('charges.monthAmount', { month: lbl, amount: formatMad(total) })}
                >
                  <div
                    style={{
                      width: '100%',
                      height: Math.max(h, total > 0 ? 4 : 0),
                      background: total > 0 ? 'var(--primary)' : 'var(--border)',
                      borderRadius: 4,
                      minHeight: total > 0 ? 4 : 2,
                    }}
                    aria-hidden="true"
                  />
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{lbl}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* Barre de filtres avancés — user request 2026-05-28 :
            « possibilité de faire des filtres plus avancés sur les charges ».
            Catégorie + Périodicité serveur-side (re-fetch), Date range serveur,
            Min/Max montant + recherche fournisseur côté client. */}
        <Panel style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, alignItems: 'end' }}>
            <FilterField label={t('charges.filter.category')}>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}
                aria-label={t('charges.filter.byCategoryAria')}
                style={filterCtl}
              >
                <option value="">{t('charges.filter.all')}</option>
                {CATEGORY_ORDER.map((c) => (
                  <option key={c} value={c}>{catLabel(c)}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label={t('charges.filter.periodicity')}>
              <Select
                value={periodicityFilter}
                onChange={(e) => setPeriodicityFilter(e.target.value as ExpensePeriodicity | '')}
                aria-label={t('charges.filter.byPeriodicityAria')}
                style={filterCtl}
              >
                <option value="">{t('charges.filter.all')}</option>
                {PERIODICITY_ORDER.map((p) => (
                  <option key={p} value={p}>{perLabel(p)}</option>
                ))}
              </Select>
            </FilterField>
            <FilterField label={t('charges.filter.dateFrom')}>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                aria-label={t('charges.filter.startDateAria')}
                style={filterCtl}
              />
            </FilterField>
            <FilterField label={t('charges.filter.dateTo')}>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                aria-label={t('charges.filter.endDateAria')}
                style={filterCtl}
              />
            </FilterField>
            <FilterField label={t('charges.filter.amountMin')}>
              <input
                type="number"
                inputMode="decimal"
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder="0"
                aria-label={t('charges.filter.amountMinAria')}
                style={filterCtl}
              />
            </FilterField>
            <FilterField label={t('charges.filter.amountMax')}>
              <input
                type="number"
                inputMode="decimal"
                value={amountMax}
                onChange={(e) => setAmountMax(e.target.value)}
                placeholder="∞"
                aria-label={t('charges.filter.amountMaxAria')}
                style={filterCtl}
              />
            </FilterField>
            <FilterField label={t('charges.filter.supplierLabel')}>
              <input
                type="search"
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                placeholder={t('charges.filter.supplierPlaceholder')}
                aria-label={t('charges.filter.supplierAria')}
                style={filterCtl}
              />
            </FilterField>
          </div>
          {hasActiveFilter && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span>
                {t('charges.filter.results', { n: expenses.length, s: expenses.length > 1 ? 's' : '' })}
                {rawExpenses.length !== expenses.length && ` ${t('charges.filter.resultsOf', { total: rawExpenses.length })}`}
              </span>
              <button
                type="button"
                onClick={resetFilters}
                style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                  padding: '4px 10px', cursor: 'pointer', fontSize: 11.5, fontFamily: 'inherit',
                  color: 'var(--primary)',
                }}
              >
                {t('charges.filter.reset')}
              </button>
            </div>
          )}
        </Panel>

        {/* Tableau */}
        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{t('charges.loading')}</div>
          )}
          {!isLoading && expenses.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              {t('charges.empty')}
            </div>
          )}
          {!isLoading && expenses.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th style={{ width: 110 }}>{t('charges.col.date')}</Th>
                  <Th>{t('charges.col.category')}</Th>
                  <Th>{t('charges.col.label')}</Th>
                  <Th style={{ textAlign: 'right', width: 130 }}>{t('charges.col.amount')}</Th>
                  <Th style={{ width: 110 }}>{t('charges.col.periodicity')}</Th>
                  <Th>{t('charges.col.supplier')}</Th>
                  <Th style={{ width: 110 }}> </Th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <Td className="tnum">{e.expenseDate}</Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 11, padding: '2px 8px',
                          border: '1px solid var(--border)', borderRadius: 12,
                          background: 'var(--surface-2)', color: 'var(--ink-2)',
                        }}
                      >
                        {catLabel(e.category)}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ fontWeight: 600 }}>{e.label}</div>
                      {e.notes && (
                        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{e.notes}</div>
                      )}
                    </Td>
                    <Td className="tnum" style={{ textAlign: 'right' }}>{formatMad(e.amount)}</Td>
                    <Td>{perLabel(e.periodicity)}</Td>
                    <Td>{e.supplier ?? ''}</Td>
                    <Td>
                      {e.source === 'HR' ? (
                        <span
                          title={t('charges.hrBadgeTitle')}
                          style={{
                            fontSize: 11, padding: '2px 8px', borderRadius: 12,
                            border: '1px solid var(--border)', background: 'var(--surface-2)',
                            color: 'var(--ink-3)',
                          }}
                        >
                          {t('charges.hrBadge')}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" onClick={() => openEdit(e)} style={btnLink}>
                            {t('charges.edit')}
                          </button>
                          <button
                            type="button"
                            onClick={() => { void handleDelete(e); }}
                            aria-label={t('charges.deleteAria', { label: e.label })}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--danger)', padding: 4, lineHeight: 0,
                            }}
                          >
                            <Trash />
                          </button>
                        </div>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {drawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(20,18,12,0.45)', zIndex: 100,
            display: 'flex', justifyContent: 'flex-end',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div
            style={{
              width: 'min(480px, 92vw)', height: '100%',
              background: 'var(--surface)', boxShadow: '-16px 0 40px rgba(0,0,0,0.1)',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <InvoiceIcon />
              <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0, flex: 1 }}>
                {editingId ? t('charges.editTitle') : t('charges.newTitle')}
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}
                aria-label={t('charges.close')}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, flex: 1, overflow: 'auto' }}>
              <SelectField
                label={t('charges.form.category')}
                value={form.category}
                onChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}
                options={CATEGORY_ORDER.map((c) => ({ value: c, label: catLabel(c) }))}
              />
              <Field
                label={t('charges.form.label')}
                value={form.label}
                onChange={(v) => setForm({ ...form, label: v })}
                placeholder={t('charges.form.labelPlaceholder')}
              />
              <Field
                label={t('charges.form.amount')}
                value={form.amount}
                onChange={(v) => setForm({ ...form, amount: v.replace(/[^0-9.]/g, '') })}
                placeholder={t('charges.form.amountPlaceholder')}
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('charges.form.date')}</span>
                <input
                  type="date"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                  style={{
                    height: 34, padding: '0 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
                  }}
                />
              </label>
              <SelectField
                label={t('charges.form.periodicity')}
                value={form.periodicity}
                onChange={(v) => setForm({ ...form, periodicity: v as ExpensePeriodicity })}
                options={PERIODICITY_ORDER.map((p) => ({ value: p, label: perLabel(p) }))}
              />
              <Field
                label={t('charges.form.supplier')}
                value={form.supplier}
                onChange={(v) => setForm({ ...form, supplier: v })}
                placeholder={t('charges.form.supplierPlaceholder')}
              />
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('charges.form.notes')}</span>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  placeholder={t('charges.form.notesPlaceholder')}
                  style={{
                    padding: '8px 10px',
                    border: '1px solid var(--border)', borderRadius: 6,
                    fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)', resize: 'vertical',
                  }}
                />
              </label>
            </div>
            <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button type="button" onClick={() => setDrawerOpen(false)}>{t('common.cancel')}</Button>
              <Button
                type="button"
                variant="primary"
                disabled={creating || updating}
                onClick={() => { void handleSave(); }}
              >
                {editingId ? t('charges.form.save') : t('charges.form.create')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Screen>
  );
}

const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11.5, padding: '4px 8px', borderRadius: 4,
  color: 'var(--primary)', fontFamily: 'inherit',
};

const filterCtl: React.CSSProperties = {
  height: 32,
  padding: '0 8px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontFamily: 'inherit',
  fontSize: 12.5,
  background: 'var(--surface)',
  color: 'var(--ink)',
  width: '100%',
};

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th
      style={{
        textAlign: 'left', padding: '10px 14px', fontWeight: 600,
        fontSize: 11.5, color: 'var(--ink-3)', textTransform: 'uppercase',
        letterSpacing: '0.04em',
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children, style, className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <td className={className} style={{ padding: '8px 14px', verticalAlign: 'top', ...style }}>
      {children}
    </td>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          height: 34, padding: '0 10px',
          border: '1px solid var(--border)', borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
        }}
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 34, padding: '0 10px',
          border: '1px solid var(--border)', borderRadius: 6,
          fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </label>
  );
}
