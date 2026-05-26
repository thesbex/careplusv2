/**
 * QA9-14 — Personnel (RH) — mobile. ADMIN uniquement.
 * Liste de cartes membre + feuille détail (récap congés + entrées + paiements)
 * et feuille d'ajout/édition membre. Parité fonctionnelle avec le desktop.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import {
  useStaffList,
  useStaffSummary,
  useLeaveEntries,
  useSalaryPayments,
  useCreateStaff,
  useUpdateStaff,
  useDeleteStaff,
  useCreateLeaveEntry,
  useDeleteLeaveEntry,
  useCreateSalaryPayment,
  useDeleteSalaryPayment,
} from './hooks/useStaff';
import {
  ROLE_LABELS,
  ROLE_ORDER,
  LEAVE_TYPE_LABELS,
  LEAVE_TYPE_ORDER,
  formatMad,
  formatDays,
  type StaffResponse,
  type StaffRole,
  type StaffRequest,
  type LeaveType,
  type LeaveEntryRequest,
  type SalaryPaymentRequest,
} from './types';

interface StaffFormState {
  fullName: string;
  role: StaffRole;
  hireDate: string;
  monthlySalary: string;
  phone: string;
  active: boolean;
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

function thisMonthLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const EMPTY_STAFF_FORM: StaffFormState = {
  fullName: '',
  role: 'SECRETAIRE',
  hireDate: todayLocal(),
  monthlySalary: '',
  phone: '',
  active: true,
  notes: '',
};

export default function PersonnelMobilePage() {
  const navigate = useNavigate();
  const { staff, isLoading } = useStaffList();
  const { createStaff, isPending: creating } = useCreateStaff();
  const { updateStaff, isPending: updating } = useUpdateStaff();
  const { deleteStaff } = useDeleteStaff();

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_STAFF_FORM);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailMember = staff.find((s) => s.id === detailId) ?? null;

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_STAFF_FORM, hireDate: todayLocal() });
    setFormOpen(true);
  }
  function openEdit(s: StaffResponse) {
    setEditingId(s.id);
    setForm({
      fullName: s.fullName,
      role: s.role,
      hireDate: s.hireDate,
      monthlySalary: s.monthlySalary != null ? String(s.monthlySalary) : '',
      phone: s.phone ?? '',
      active: s.active,
      notes: s.notes ?? '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.fullName.trim()) {
      toast.error('Le nom est requis.');
      return;
    }
    if (!form.hireDate) {
      toast.error('La date de recrutement est requise.');
      return;
    }
    let salary: number | undefined;
    if (form.monthlySalary.trim()) {
      const n = Number(form.monthlySalary);
      if (Number.isNaN(n) || n < 0) {
        toast.error('Le salaire doit être un nombre positif.');
        return;
      }
      salary = n;
    }
    const body: StaffRequest = {
      fullName: form.fullName.trim(),
      role: form.role,
      hireDate: form.hireDate,
      active: form.active,
      ...(salary !== undefined ? { monthlySalary: salary } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
    };
    try {
      if (editingId) {
        await updateStaff({ id: editingId, body });
        toast.success('Membre mis à jour.');
      } else {
        await createStaff(body);
        toast.success('Membre ajouté.');
      }
      setFormOpen(false);
      setForm(EMPTY_STAFF_FORM);
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

  async function handleDelete(s: StaffResponse) {
    if (!confirm(`Supprimer le membre « ${s.fullName} » ?`)) return;
    try {
      await deleteStaff(s.id);
      if (detailId === s.id) setDetailId(null);
      setFormOpen(false);
      toast.success('Membre supprimé.');
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
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/parametres')} />}
          title="Personnel"
          sub={`${staff.length} membre${staff.length > 1 ? 's' : ''}`}
          right={<MIconBtn icon="Plus" label="Ajouter un membre" onClick={openCreate} />}
        />
      }
    >
      <div className="mb-pad">
        <div className="m-card">
          {isLoading ? (
            <div style={{ padding: 20, color: 'var(--ink-3)', fontSize: 13, textAlign: 'center' }}>
              Chargement…
            </div>
          ) : staff.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun membre du personnel.
            </div>
          ) : (
            staff.map((s) => (
              <button
                key={s.id}
                type="button"
                className="m-row"
                onClick={() => setDetailId(s.id)}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 0, font: 'inherit', fontFamily: 'inherit', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div className="m-row-pri">
                  <div className="m-row-main">
                    {s.fullName}
                    {!s.active && (
                      <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · inactif</span>
                    )}
                  </div>
                  <div className="m-row-sub">
                    {ROLE_LABELS[s.role]}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </div>
                </div>
                <span className="tnum" style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                  {s.monthlySalary != null ? formatMad(s.monthlySalary) : '—'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {formOpen && (
        <Sheet
          title={editingId ? 'Modifier le membre' : 'Nouveau membre'}
          onClose={() => setFormOpen(false)}
        >
          <MField label="Nom complet *">
            <input
              type="text"
              className="m-input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              placeholder="ex. Fatima Zahra Bennani"
            />
          </MField>
          <MField label="Poste *">
            <select
              className="m-input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </MField>
          <MField label="Date de recrutement *">
            <input
              type="date"
              className="m-input"
              value={form.hireDate}
              onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
            />
          </MField>
          <MField label="Salaire mensuel (MAD)">
            <input
              type="text"
              inputMode="decimal"
              className="m-input"
              value={form.monthlySalary}
              onChange={(e) => setForm({ ...form, monthlySalary: e.target.value.replace(/[^0-9.]/g, '') })}
              placeholder="ex. 4500"
            />
          </MField>
          <MField label="Téléphone">
            <input
              type="text"
              className="m-input"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="ex. 0612345678"
            />
          </MField>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
            />
            Membre actif
          </label>
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
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  const target = staff.find((x) => x.id === editingId);
                  if (target) void handleDelete(target);
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
              style={primaryBtn}
            >
              {editingId ? 'Enregistrer' : 'Ajouter le membre'}
            </button>
          </div>
        </Sheet>
      )}

      {detailMember && (
        <DetailSheet
          member={detailMember}
          onClose={() => setDetailId(null)}
          onEdit={() => { setDetailId(null); openEdit(detailMember); }}
        />
      )}
    </MScreen>
  );
}

/* ----------------------------- detail sheet ----------------------------- */

function DetailSheet({
  member, onClose, onEdit,
}: {
  member: StaffResponse;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { summary } = useStaffSummary(member.id);
  const { entries } = useLeaveEntries(member.id);
  const { payments } = useSalaryPayments(member.id);
  const { createLeave, isPending: addingLeave } = useCreateLeaveEntry();
  const { deleteLeave } = useDeleteLeaveEntry();
  const { createPayment, isPending: addingPayment } = useCreateSalaryPayment();
  const { deletePayment } = useDeleteSalaryPayment();

  const [leaveForm, setLeaveForm] = useState({
    type: 'CONGE' as LeaveType,
    startDate: todayLocal(),
    days: '1',
    notes: '',
  });
  const [payForm, setPayForm] = useState({
    period: thisMonthLocal(),
    amount: member.monthlySalary != null ? String(member.monthlySalary) : '',
    paidAt: todayLocal(),
    notes: '',
  });

  async function handleAddLeave() {
    if (!leaveForm.startDate) {
      toast.error('La date est requise.');
      return;
    }
    const daysNum = leaveForm.days.trim() ? Number(leaveForm.days) : undefined;
    if (daysNum !== undefined && (Number.isNaN(daysNum) || daysNum <= 0)) {
      toast.error('Le nombre de jours doit être positif.');
      return;
    }
    const body: LeaveEntryRequest = {
      type: leaveForm.type,
      startDate: leaveForm.startDate,
      ...(daysNum !== undefined ? { days: daysNum } : {}),
      ...(leaveForm.notes.trim() ? { notes: leaveForm.notes.trim() } : {}),
    };
    try {
      await createLeave({ staffId: member.id, body });
      toast.success('Entrée ajoutée.');
      setLeaveForm({ type: 'CONGE', startDate: todayLocal(), days: '1', notes: '' });
    } catch {
      toast.error("Échec de l'ajout.");
    }
  }

  async function handleDeleteLeave(id: string) {
    if (!confirm('Supprimer cette entrée ?')) return;
    try {
      await deleteLeave({ id, staffId: member.id });
      toast.success('Entrée supprimée.');
    } catch {
      toast.error('Suppression impossible.');
    }
  }

  async function handleAddPayment() {
    if (!payForm.period) {
      toast.error('La période est requise.');
      return;
    }
    const amount = Number(payForm.amount);
    if (!payForm.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      toast.error('Le montant doit être un nombre positif.');
      return;
    }
    if (!payForm.paidAt) {
      toast.error('La date de paiement est requise.');
      return;
    }
    const body: SalaryPaymentRequest = {
      period: payForm.period,
      amount,
      paidAt: payForm.paidAt,
      ...(payForm.notes.trim() ? { notes: payForm.notes.trim() } : {}),
    };
    try {
      await createPayment({ staffId: member.id, body });
      toast.success('Paiement enregistré.');
      setPayForm({ period: thisMonthLocal(), amount: payForm.amount, paidAt: todayLocal(), notes: '' });
    } catch {
      toast.error("Échec de l'enregistrement.");
    }
  }

  async function handleDeletePayment(id: string) {
    if (!confirm('Supprimer ce paiement ?')) return;
    try {
      await deletePayment({ id, staffId: member.id });
      toast.success('Paiement supprimé.');
    } catch {
      toast.error('Suppression impossible.');
    }
  }

  return (
    <Sheet title={member.fullName} sub={ROLE_LABELS[member.role]} onClose={onClose}>
      <button type="button" onClick={onEdit} style={{ ...primaryBtn, background: 'var(--surface-2)', color: 'var(--ink)' }}>
        Modifier la fiche
      </button>

      {/* Récap congés */}
      <h3 style={sectionTitle}>Congés</h3>
      {summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>
            Solde congés : {formatDays(summary.leaveBalanceDays)} j
          </div>
          <div style={{ color: 'var(--ink-3)' }}>
            Acquis : {formatDays(summary.accruedLeaveDays)} j ({summary.monthsWorked} mois × 1,5)
          </div>
          <div style={{ color: 'var(--ink-3)' }}>Pris : {formatDays(summary.takenLeaveDays)} j</div>
          <div style={{ color: 'var(--ink-3)' }}>Absences : {summary.absencesCount}</div>
          <div style={{ color: 'var(--ink-3)' }}>Retards : {summary.latenessCount}</div>
        </div>
      ) : (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
      )}

      {/* Entrées congé/absence/retard */}
      <h3 style={sectionTitle}>Congés, absences & retards</h3>
      {entries.length === 0 ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Aucune entrée.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
              }}
            >
              <span style={{ fontWeight: 600, minWidth: 56 }}>{LEAVE_TYPE_LABELS[e.type]}</span>
              <span className="tnum">{e.startDate}</span>
              <span style={{ color: 'var(--ink-3)' }}>{formatDays(e.days)} j</span>
              <button
                type="button"
                onClick={() => { void handleDeleteLeave(e.id); }}
                aria-label="Supprimer l'entrée"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}
              >
                Suppr.
              </button>
            </div>
          ))}
        </div>
      )}
      <MField label="Type">
        <select
          className="m-input"
          value={leaveForm.type}
          onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as LeaveType })}
        >
          {LEAVE_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </MField>
      <MField label="Date">
        <input
          type="date"
          className="m-input"
          value={leaveForm.startDate}
          onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
        />
      </MField>
      <MField label="Jours">
        <input
          type="text"
          inputMode="decimal"
          className="m-input"
          value={leaveForm.days}
          onChange={(e) => setLeaveForm({ ...leaveForm, days: e.target.value.replace(/[^0-9.]/g, '') })}
          placeholder="ex. 1"
        />
      </MField>
      <MField label="Notes">
        <input
          type="text"
          className="m-input"
          value={leaveForm.notes}
          onChange={(e) => setLeaveForm({ ...leaveForm, notes: e.target.value })}
          placeholder="Optionnel"
        />
      </MField>
      <button type="button" disabled={addingLeave} onClick={() => { void handleAddLeave(); }} style={primaryBtn}>
        Ajouter congé/absence/retard
      </button>

      {/* Paiements */}
      <h3 style={sectionTitle}>Paiements de salaire</h3>
      {payments.length === 0 ? (
        <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Aucun paiement.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {payments.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8,
              }}
            >
              <span className="tnum" style={{ fontWeight: 600, minWidth: 56 }}>{p.period}</span>
              <span className="tnum">{formatMad(p.amount)}</span>
              <span style={{ color: 'var(--ink-3)' }} className="tnum">{p.paidAt}</span>
              <button
                type="button"
                onClick={() => { void handleDeletePayment(p.id); }}
                aria-label="Supprimer le paiement"
                style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 13 }}
              >
                Suppr.
              </button>
            </div>
          ))}
        </div>
      )}
      <MField label="Période">
        <input
          type="month"
          className="m-input"
          value={payForm.period}
          onChange={(e) => setPayForm({ ...payForm, period: e.target.value })}
        />
      </MField>
      <MField label="Montant (MAD)">
        <input
          type="text"
          inputMode="decimal"
          className="m-input"
          value={payForm.amount}
          onChange={(e) => setPayForm({ ...payForm, amount: e.target.value.replace(/[^0-9.]/g, '') })}
          placeholder="ex. 4500"
        />
      </MField>
      <MField label="Payé le">
        <input
          type="date"
          className="m-input"
          value={payForm.paidAt}
          onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
        />
      </MField>
      <MField label="Notes">
        <input
          type="text"
          className="m-input"
          value={payForm.notes}
          onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
          placeholder="Optionnel"
        />
      </MField>
      <button type="button" disabled={addingPayment} onClick={() => { void handleAddPayment(); }} style={primaryBtn}>
        Enregistrer un paiement
      </button>
    </Sheet>
  );
}

/* ----------------------------- shared mobile UI ----------------------------- */

const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 650, margin: '8px 0 0',
  textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-3)',
};

const primaryBtn: React.CSSProperties = {
  flex: 1, padding: '10px 14px',
  background: 'var(--primary)', color: 'white',
  border: 0, borderRadius: 8, fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

function Sheet({
  title, sub, onClose, children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(20,18,12,0.45)',
        display: 'flex', alignItems: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: '100%', maxHeight: '92vh',
          background: 'var(--surface)',
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 15, fontWeight: 650, margin: 0 }}>{title}</h2>
            {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{sub}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-3)' }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
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
