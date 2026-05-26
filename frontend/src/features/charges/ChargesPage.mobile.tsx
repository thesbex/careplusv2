/**
 * QA9-15 — Charges (dépenses) — mobile. ADMIN uniquement.
 * Liste de cartes + feuille d'ajout/édition (parité création / édition / suppression
 * avec le desktop). Récapitulatif annuel compact en tête.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import {
  useExpenses,
  useExpenseSummary,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
} from './hooks/useExpenses';
import {
  CATEGORY_LABELS,
  PERIODICITY_LABELS,
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
      toast.error('Le libellé est requis.');
      return;
    }
    const amount = Number(form.amount);
    if (!form.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      toast.error('Le montant doit être un nombre positif.');
      return;
    }
    if (!form.expenseDate) {
      toast.error('La date est requise.');
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
        toast.success('Charge mise à jour.');
      } else {
        await createExpense(body);
        toast.success('Charge ajoutée.');
      }
      setSheetOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      toast.error(
        e.response?.status === 403
          ? 'Permission refusée (rôle ADMIN requis).'
          : "Échec de l'enregistrement.",
      );
    }
  }

  async function handleDelete(e: ExpenseResponse) {
    if (!confirm(`Supprimer la charge « ${e.label} » ?`)) return;
    try {
      await deleteExpense(e.id);
      toast.success('Charge supprimée.');
    } catch {
      toast.error('Suppression impossible.');
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
            <MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/parametres')} />
          }
          title="Charges"
          sub={`${expenses.length} charge${expenses.length > 1 ? 's' : ''}`}
          right={
            <MIconBtn icon="Plus" label="Ajouter une charge" onClick={openCreate} />
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
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Total {year}</span>
          <span style={{ fontSize: 15, fontWeight: 700 }} className="tnum">{formatMad(yearTotal)}</span>
        </div>

        {/* Filtre catégorie */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | '')}
          className="m-input"
          aria-label="Filtrer par catégorie"
          style={{ marginBottom: 14 }}
        >
          <option value="">Toutes les catégories</option>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        {/* Liste */}
        <div className="m-card">
          {isLoading ? (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
              Chargement…
            </div>
          ) : expenses.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Aucune charge enregistrée.
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
                    {CATEGORY_LABELS[e.category]} · {PERIODICITY_LABELS[e.periodicity]} ·{' '}
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
                {editingId ? 'Modifier la charge' : 'Nouvelle charge'}
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-3)' }}
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
              <MField label="Catégorie *">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}
                  className="m-input"
                >
                  {CATEGORY_ORDER.map((c) => (
                    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                  ))}
                </select>
              </MField>
              <MField label="Libellé *">
                <input
                  type="text"
                  className="m-input"
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="ex. Facture Lydec avril"
                />
              </MField>
              <MField label="Montant (MAD) *">
                <input
                  type="text"
                  inputMode="decimal"
                  className="m-input"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^0-9.]/g, '') })}
                  placeholder="ex. 1250.00"
                />
              </MField>
              <MField label="Date *">
                <input
                  type="date"
                  className="m-input"
                  value={form.expenseDate}
                  onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                />
              </MField>
              <MField label="Périodicité *">
                <select
                  value={form.periodicity}
                  onChange={(e) => setForm({ ...form, periodicity: e.target.value as ExpensePeriodicity })}
                  className="m-input"
                >
                  {PERIODICITY_ORDER.map((p) => (
                    <option key={p} value={p}>{PERIODICITY_LABELS[p]}</option>
                  ))}
                </select>
              </MField>
              <MField label="Fournisseur">
                <input
                  type="text"
                  className="m-input"
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                  placeholder="ex. Lydec, Maroc Telecom…"
                />
              </MField>
              <MField label="Notes">
                <textarea
                  className="m-input"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Remarque interne (optionnel)"
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
                  Supprimer
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
                {editingId ? 'Enregistrer' : 'Ajouter la charge'}
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
