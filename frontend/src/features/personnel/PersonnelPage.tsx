/**
 * QA9-14 — Screen « Personnel » (RH du cabinet). ADMIN uniquement.
 *
 * - Tableau du personnel (nom, poste FR, date recrutement, salaire MAD, téléphone, statut actif).
 * - Tiroir « Ajouter un membre » / édition (fullName, role, hireDate, monthlySalary, phone, active, notes).
 * - Suppression (soft) avec confirmation.
 * - Sélection d'un membre → tiroir détail : récap congés (/summary), liste congés/absences/retards
 *   + ajout, liste paiements de salaire + ajout.
 *
 * Endpoints : /api/hr/staff (+ /{id}/summary, /{id}/leave, /{id}/payments).
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Plus, Trash, Users as UsersIcon } from '@/components/icons';
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

/** Date du jour en YYYY-MM-DD à partir des composantes LOCALES (pas toISOString → UTC). */
function todayLocal(): string {
  const d = new Date();
  return (
    `${d.getFullYear()}-` +
    `${String(d.getMonth() + 1).padStart(2, '0')}-` +
    `${String(d.getDate()).padStart(2, '0')}`
  );
}

/** Mois courant en YYYY-MM (pour <input type="month">). */
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

export default function PersonnelPage() {
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
    // exactOptionalPropertyTypes : n'inclure les champs optionnels que s'ils sont définis.
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
      toast.success('Membre supprimé.');
    } catch {
      toast.error('Suppression impossible.');
    }
  }

  return (
    <Screen
      active="personnel"
      title="Personnel"
      sub={`${staff.length} membre${staff.length > 1 ? 's' : ''}`}
      topbarRight={
        <Button variant="primary" onClick={openCreate}>
          <Plus /> Ajouter un membre
        </Button>
      }
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement…</div>
          )}
          {!isLoading && staff.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              Aucun membre du personnel.
            </div>
          )}
          {!isLoading && staff.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th>Nom</Th>
                  <Th>Poste</Th>
                  <Th style={{ width: 130 }}>Recrutement</Th>
                  <Th style={{ textAlign: 'right', width: 140 }}>Salaire mensuel</Th>
                  <Th style={{ width: 130 }}>Téléphone</Th>
                  <Th style={{ width: 90 }}>Statut</Th>
                  <Th style={{ width: 150 }}> </Th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr
                    key={s.id}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: detailId === s.id ? 'var(--surface-2)' : undefined,
                    }}
                  >
                    <Td>
                      <button
                        type="button"
                        onClick={() => setDetailId(s.id)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          font: 'inherit', fontFamily: 'inherit', fontWeight: 600,
                          color: 'var(--primary)', textAlign: 'left',
                        }}
                      >
                        {s.fullName}
                      </button>
                    </Td>
                    <Td>{ROLE_LABELS[s.role]}</Td>
                    <Td className="tnum">{s.hireDate}</Td>
                    <Td className="tnum" style={{ textAlign: 'right' }}>
                      {s.monthlySalary != null ? formatMad(s.monthlySalary) : '—'}
                    </Td>
                    <Td className="tnum">{s.phone ?? '—'}</Td>
                    <Td>
                      <span
                        style={{
                          fontSize: 11, padding: '2px 8px',
                          border: '1px solid var(--border)', borderRadius: 12,
                          background: s.active ? 'var(--primary-soft)' : 'var(--surface-2)',
                          color: s.active ? 'var(--primary)' : 'var(--ink-3)',
                        }}
                      >
                        {s.active ? 'Actif' : 'Inactif'}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => setDetailId(s.id)} style={btnLink}>
                          Détail
                        </button>
                        <button type="button" onClick={() => openEdit(s)} style={btnLink}>
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleDelete(s); }}
                          aria-label={`Supprimer ${s.fullName}`}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--danger)', padding: 4, lineHeight: 0,
                          }}
                        >
                          <Trash />
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>

      {formOpen && (
        <StaffFormDrawer
          editing={!!editingId}
          form={form}
          setForm={setForm}
          busy={creating || updating}
          onClose={() => setFormOpen(false)}
          onSave={() => { void handleSave(); }}
        />
      )}

      {detailMember && (
        <StaffDetailDrawer member={detailMember} onClose={() => setDetailId(null)} />
      )}
    </Screen>
  );
}

/* ----------------------------- staff form drawer ----------------------------- */

function StaffFormDrawer({
  editing, form, setForm, busy, onClose, onSave,
}: {
  editing: boolean;
  form: StaffFormState;
  setForm: (f: StaffFormState) => void;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <DrawerShell
      title={editing ? 'Modifier le membre' : 'Nouveau membre'}
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>Annuler</Button>
          <Button type="button" variant="primary" disabled={busy} onClick={onSave}>
            {editing ? 'Enregistrer' : 'Ajouter le membre'}
          </Button>
        </>
      }
    >
      <Field
        label="Nom complet *"
        value={form.fullName}
        onChange={(v) => setForm({ ...form, fullName: v })}
        placeholder="ex. Fatima Zahra Bennani"
      />
      <SelectField
        label="Poste *"
        value={form.role}
        onChange={(v) => setForm({ ...form, role: v as StaffRole })}
        options={ROLE_ORDER.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
      />
      <DateField
        label="Date de recrutement *"
        value={form.hireDate}
        onChange={(v) => setForm({ ...form, hireDate: v })}
      />
      <Field
        label="Salaire mensuel (MAD)"
        value={form.monthlySalary}
        onChange={(v) => setForm({ ...form, monthlySalary: v.replace(/[^0-9.]/g, '') })}
        placeholder="ex. 4500"
      />
      <Field
        label="Téléphone"
        value={form.phone}
        onChange={(v) => setForm({ ...form, phone: v })}
        placeholder="ex. 0612345678"
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        Membre actif
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder="Remarque interne (optionnel)"
          style={{
            padding: '8px 10px',
            border: '1px solid var(--border)', borderRadius: 6,
            fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)', resize: 'vertical',
          }}
        />
      </label>
    </DrawerShell>
  );
}

/* ----------------------------- detail drawer ----------------------------- */

function StaffDetailDrawer({
  member, onClose,
}: {
  member: StaffResponse;
  onClose: () => void;
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
    <DrawerShell title={member.fullName} sub={ROLE_LABELS[member.role]} onClose={onClose}>
      {/* Récap congés */}
      <section>
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
      </section>

      {/* Liste des entrées congé/absence/retard */}
      <section>
        <h3 style={sectionTitle}>Congés, absences & retards</h3>
        {entries.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Aucune entrée.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6,
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 64 }}>{LEAVE_TYPE_LABELS[e.type]}</span>
                <span className="tnum">{e.startDate}</span>
                <span style={{ color: 'var(--ink-3)' }}>{formatDays(e.days)} j</span>
                {e.notes && <span style={{ color: 'var(--ink-3)', flex: 1 }}>{e.notes}</span>}
                <button
                  type="button"
                  onClick={() => { void handleDeleteLeave(e.id); }}
                  aria-label="Supprimer l'entrée"
                  style={{
                    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--danger)', padding: 4, lineHeight: 0,
                  }}
                >
                  <Trash />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <SelectField
            label="Type"
            value={leaveForm.type}
            onChange={(v) => setLeaveForm({ ...leaveForm, type: v as LeaveType })}
            options={LEAVE_TYPE_ORDER.map((t) => ({ value: t, label: LEAVE_TYPE_LABELS[t] }))}
          />
          <DateField
            label="Date"
            value={leaveForm.startDate}
            onChange={(v) => setLeaveForm({ ...leaveForm, startDate: v })}
          />
          <Field
            label="Jours"
            value={leaveForm.days}
            onChange={(v) => setLeaveForm({ ...leaveForm, days: v.replace(/[^0-9.]/g, '') })}
            placeholder="ex. 1"
          />
          <Field
            label="Notes"
            value={leaveForm.notes}
            onChange={(v) => setLeaveForm({ ...leaveForm, notes: v })}
            placeholder="Optionnel"
          />
          <Button type="button" disabled={addingLeave} onClick={() => { void handleAddLeave(); }}>
            <Plus /> Ajouter congé/absence/retard
          </Button>
        </div>
      </section>

      {/* Paiements de salaire */}
      <section>
        <h3 style={sectionTitle}>Paiements de salaire</h3>
        {payments.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Aucun paiement.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {payments.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6,
                }}
              >
                <span className="tnum" style={{ fontWeight: 600, minWidth: 64 }}>{p.period}</span>
                <span className="tnum">{formatMad(p.amount)}</span>
                <span style={{ color: 'var(--ink-3)' }}>payé le <span className="tnum">{p.paidAt}</span></span>
                <button
                  type="button"
                  onClick={() => { void handleDeletePayment(p.id); }}
                  aria-label="Supprimer le paiement"
                  style={{
                    marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--danger)', padding: 4, lineHeight: 0,
                  }}
                >
                  <Trash />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>Période</span>
            <input
              type="month"
              value={payForm.period}
              onChange={(e) => setPayForm({ ...payForm, period: e.target.value })}
              style={inputStyle}
            />
          </label>
          <Field
            label="Montant (MAD)"
            value={payForm.amount}
            onChange={(v) => setPayForm({ ...payForm, amount: v.replace(/[^0-9.]/g, '') })}
            placeholder="ex. 4500"
          />
          <DateField
            label="Payé le"
            value={payForm.paidAt}
            onChange={(v) => setPayForm({ ...payForm, paidAt: v })}
          />
          <Field
            label="Notes"
            value={payForm.notes}
            onChange={(v) => setPayForm({ ...payForm, notes: v })}
            placeholder="Optionnel"
          />
          <Button type="button" disabled={addingPayment} onClick={() => { void handleAddPayment(); }}>
            <Plus /> Enregistrer un paiement
          </Button>
        </div>
      </section>
    </DrawerShell>
  );
}

/* ----------------------------- shared UI ----------------------------- */

const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 650, margin: '0 0 8px',
  textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--ink-3)',
};

const inputStyle: React.CSSProperties = {
  height: 34, padding: '0 10px',
  border: '1px solid var(--border)', borderRadius: 6,
  fontFamily: 'inherit', fontSize: 13, background: 'var(--surface)',
};

const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 11.5, padding: '4px 8px', borderRadius: 4,
  color: 'var(--primary)', fontFamily: 'inherit',
};

function DrawerShell({
  title, sub, onClose, footer, children,
}: {
  title: string;
  sub?: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(20,18,12,0.45)', zIndex: 100,
        display: 'flex', justifyContent: 'flex-end',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          width: 'min(520px, 94vw)', height: '100%',
          background: 'var(--surface)', boxShadow: '-16px 0 40px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <UsersIcon />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 650, margin: 0 }}>{title}</h2>
            {sub && <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{sub}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--ink-3)' }}
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, overflow: 'auto' }}>
          {children}
        </div>
        {footer && (
          <div style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
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
        style={inputStyle}
      />
    </label>
  );
}

function DateField({
  label, value, onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
      <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{label}</span>
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
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
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
