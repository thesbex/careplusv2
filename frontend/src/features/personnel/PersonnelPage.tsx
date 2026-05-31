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
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Select } from '@/components/ui/Input';
import { Plus, Trash, Users as UsersIcon } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
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
  ROLE_LABEL_KEYS,
  ROLE_ORDER,
  LEAVE_TYPE_LABEL_KEYS,
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
  const { t } = useT();
  const { staff: rawStaff, isLoading } = useStaffList();
  const { createStaff, isPending: creating } = useCreateStaff();
  const { updateStaff, isPending: updating } = useUpdateStaff();
  const { deleteStaff } = useDeleteStaff();

  // Filtres user-request 2026-05-28 : nom, rôle, statut actif. Client-side
  // (la liste personnel reste petite, pas de pagination).
  const [nameSearch, setNameSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');

  const staff = useMemo(() => {
    let out = rawStaff;
    if (nameSearch.trim()) {
      const needle = nameSearch.trim().toLowerCase();
      out = out.filter(
        (s) =>
          s.fullName.toLowerCase().includes(needle) ||
          (s.phone ?? '').toLowerCase().includes(needle),
      );
    }
    if (roleFilter) out = out.filter((s) => s.role === roleFilter);
    if (statusFilter === 'active') out = out.filter((s) => s.active);
    if (statusFilter === 'inactive') out = out.filter((s) => !s.active);
    return out;
  }, [rawStaff, nameSearch, roleFilter, statusFilter]);

  const hasActiveFilter = !!nameSearch.trim() || !!roleFilter || !!statusFilter;
  function resetFilters() {
    setNameSearch('');
    setRoleFilter('');
    setStatusFilter('');
  }

  /** Export du personnel filtré + récap par membre (rôle, recrutement, salaire). */
  function exportStaffCsv() {
    const headers = [
      t('staff.csv.name'),
      t('staff.csv.role'),
      t('staff.csv.hireDate'),
      t('staff.csv.salary'),
      t('staff.csv.phone'),
      t('staff.csv.status'),
      t('staff.csv.notes'),
    ];
    const rows = staff.map((s) => [
      s.fullName,
      t(ROLE_LABEL_KEYS[s.role]),
      s.hireDate,
      s.monthlySalary != null ? String(s.monthlySalary) : '',
      s.phone ?? '',
      s.active ? t('staff.statusActive') : t('staff.statusInactive'),
      (s.notes ?? '').replace(/\s+/g, ' '),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `personnel-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<StaffFormState>(EMPTY_STAFF_FORM);

  const [detailId, setDetailId] = useState<string | null>(null);
  const detailMember = rawStaff.find((s) => s.id === detailId) ?? null;

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
      toast.error(t('staff.err.nameRequired'));
      return;
    }
    if (!form.hireDate) {
      toast.error(t('staff.err.hireDateRequired'));
      return;
    }
    let salary: number | undefined;
    if (form.monthlySalary.trim()) {
      const n = Number(form.monthlySalary);
      if (Number.isNaN(n) || n < 0) {
        toast.error(t('staff.err.salaryPositive'));
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
        toast.success(t('staff.toast.updated'));
      } else {
        await createStaff(body);
        toast.success(t('staff.toast.added'));
      }
      setFormOpen(false);
      setForm(EMPTY_STAFF_FORM);
      setEditingId(null);
    } catch (err) {
      const e = err as { response?: { status?: number } };
      toast.error(
        e.response?.status === 403
          ? t('staff.err.forbidden')
          : t('staff.err.saveFailed'),
      );
    }
  }

  async function handleDelete(s: StaffResponse) {
    if (!confirm(t('staff.confirmDelete', { name: s.fullName }))) return;
    try {
      await deleteStaff(s.id);
      if (detailId === s.id) setDetailId(null);
      toast.success(t('staff.toast.deleted'));
    } catch {
      toast.error(t('staff.err.deleteFailed'));
    }
  }

  return (
    <Screen
      active="personnel"
      title={t('staff.title')}
      sub={t('staff.count', { n: staff.length, s: staff.length > 1 ? 's' : '' })}
      topbarRight={
        <>
          <Button
            type="button"
            onClick={exportStaffCsv}
            disabled={staff.length === 0}
            title={staff.length === 0 ? t('staff.exportNothing') : t('staff.exportHint')}
          >
            {t('staff.exportCsv')}
          </Button>
          <Button variant="primary" onClick={openCreate}>
            <Plus /> {t('staff.add')}
          </Button>
        </>
      }
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Barre de filtres avancés — user request 2026-05-28 :
            recherche personnel + filtres rôle/statut. */}
        <Panel style={{ padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('staff.filter.search')}
              </span>
              <input
                type="search"
                value={nameSearch}
                onChange={(e) => setNameSearch(e.target.value)}
                placeholder={t('staff.filter.searchPlaceholder')}
                aria-label={t('staff.filter.searchAria')}
                style={inputStyle}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('staff.filter.role')}
              </span>
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as StaffRole | '')}
                aria-label={t('staff.filter.byRoleAria')}
                style={inputStyle}
              >
                <option value="">{t('staff.filter.all')}</option>
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>{t(ROLE_LABEL_KEYS[r])}</option>
                ))}
              </Select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
              <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('staff.filter.status')}
              </span>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as '' | 'active' | 'inactive')}
                aria-label={t('staff.filter.byStatusAria')}
                style={inputStyle}
              >
                <option value="">{t('staff.filter.all')}</option>
                <option value="active">{t('staff.filter.active')}</option>
                <option value="inactive">{t('staff.filter.inactive')}</option>
              </Select>
            </label>
          </div>
          {hasActiveFilter && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, fontSize: 11.5, color: 'var(--ink-3)' }}>
              <span>
                {t('staff.filter.results', { n: staff.length, s: staff.length > 1 ? 's' : '', total: rawStaff.length })}
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
                {t('staff.filter.reset')}
              </button>
            </div>
          )}
        </Panel>

        <Panel style={{ flex: 1, overflow: 'auto', padding: 0 }}>
          {isLoading && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{t('staff.loading')}</div>
          )}
          {!isLoading && staff.length === 0 && (
            <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
              {t('staff.empty')}
            </div>
          )}
          {!isLoading && staff.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                <tr>
                  <Th>{t('staff.col.name')}</Th>
                  <Th>{t('staff.col.role')}</Th>
                  <Th style={{ width: 130 }}>{t('staff.col.hireDate')}</Th>
                  <Th style={{ textAlign: 'right', width: 140 }}>{t('staff.col.salary')}</Th>
                  <Th style={{ width: 130 }}>{t('staff.col.phone')}</Th>
                  <Th style={{ width: 90 }}>{t('staff.col.status')}</Th>
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
                    <Td>{t(ROLE_LABEL_KEYS[s.role])}</Td>
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
                        {s.active ? t('staff.statusActive') : t('staff.statusInactive')}
                      </span>
                    </Td>
                    <Td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" onClick={() => setDetailId(s.id)} style={btnLink}>
                          {t('staff.detail')}
                        </button>
                        <button type="button" onClick={() => openEdit(s)} style={btnLink}>
                          {t('staff.edit')}
                        </button>
                        <button
                          type="button"
                          onClick={() => { void handleDelete(s); }}
                          aria-label={t('staff.deleteAria', { name: s.fullName })}
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
  const { t } = useT();
  return (
    <DrawerShell
      title={editing ? t('staff.editTitle') : t('staff.newTitle')}
      onClose={onClose}
      footer={
        <>
          <Button type="button" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="button" variant="primary" disabled={busy} onClick={onSave}>
            {editing ? t('staff.form.save') : t('staff.form.create')}
          </Button>
        </>
      }
    >
      <Field
        label={t('staff.form.fullName')}
        value={form.fullName}
        onChange={(v) => setForm({ ...form, fullName: v })}
        placeholder={t('staff.form.fullNamePlaceholder')}
      />
      <SelectField
        label={t('staff.form.role')}
        value={form.role}
        onChange={(v) => setForm({ ...form, role: v as StaffRole })}
        options={ROLE_ORDER.map((r) => ({ value: r, label: t(ROLE_LABEL_KEYS[r]) }))}
      />
      <DateField
        label={t('staff.form.hireDate')}
        value={form.hireDate}
        onChange={(v) => setForm({ ...form, hireDate: v })}
      />
      <Field
        label={t('staff.form.salary')}
        value={form.monthlySalary}
        onChange={(v) => setForm({ ...form, monthlySalary: v.replace(/[^0-9.]/g, '') })}
        placeholder={t('staff.form.salaryPlaceholder')}
      />
      <Field
        label={t('staff.form.phone')}
        value={form.phone}
        onChange={(v) => setForm({ ...form, phone: v })}
        placeholder={t('staff.form.phonePlaceholder')}
      />
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />
        {t('staff.form.active')}
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
        <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('staff.form.notes')}</span>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={3}
          placeholder={t('staff.form.notesPlaceholder')}
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
  const { t } = useT();
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
      toast.error(t('staff.err.dateRequired'));
      return;
    }
    const daysNum = leaveForm.days.trim() ? Number(leaveForm.days) : undefined;
    if (daysNum !== undefined && (Number.isNaN(daysNum) || daysNum <= 0)) {
      toast.error(t('staff.err.daysPositive'));
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
      toast.success(t('staff.toast.entryAdded'));
      setLeaveForm({ type: 'CONGE', startDate: todayLocal(), days: '1', notes: '' });
    } catch {
      toast.error(t('staff.err.addFailed'));
    }
  }

  async function handleDeleteLeave(id: string) {
    if (!confirm(t('staff.confirmDeleteEntry'))) return;
    try {
      await deleteLeave({ id, staffId: member.id });
      toast.success(t('staff.toast.entryDeleted'));
    } catch {
      toast.error(t('staff.err.deleteFailed'));
    }
  }

  async function handleAddPayment() {
    if (!payForm.period) {
      toast.error(t('staff.err.periodRequired'));
      return;
    }
    const amount = Number(payForm.amount);
    if (!payForm.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      toast.error(t('staff.err.amountPositive'));
      return;
    }
    if (!payForm.paidAt) {
      toast.error(t('staff.err.paidAtRequired'));
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
      toast.success(t('staff.toast.paymentAdded'));
      setPayForm({ period: thisMonthLocal(), amount: payForm.amount, paidAt: todayLocal(), notes: '' });
    } catch {
      toast.error(t('staff.err.saveFailed'));
    }
  }

  async function handleDeletePayment(id: string) {
    if (!confirm(t('staff.confirmDeletePayment'))) return;
    try {
      await deletePayment({ id, staffId: member.id });
      toast.success(t('staff.toast.paymentDeleted'));
    } catch {
      toast.error(t('staff.err.deleteFailed'));
    }
  }

  function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportLeaves() {
    const slug = member.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadCsv(
      `conges-${slug}.csv`,
      [t('staff.csv.leaveType'), t('staff.csv.date'), t('staff.csv.days'), t('staff.csv.notes')],
      entries.map((e) => [t(LEAVE_TYPE_LABEL_KEYS[e.type]), e.startDate, e.days, (e.notes ?? '').replace(/\s+/g, ' ')]),
    );
  }
  function exportPayments() {
    const slug = member.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    downloadCsv(
      `salaires-${slug}.csv`,
      [t('staff.csv.period'), t('staff.csv.amount'), t('staff.csv.paidAt'), t('staff.csv.notes')],
      payments.map((p) => [p.period, p.amount, p.paidAt, (p.notes ?? '').replace(/\s+/g, ' ')]),
    );
  }

  // Filtrage par plage de dates dans le détail — secrétaire RH peut limiter la
  // vue à un mois/trimestre avant export ("salaires Q2 2026" par ex.).
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const filteredEntries = useMemo(
    () => entries.filter((e) => (!historyFrom || e.startDate >= historyFrom) && (!historyTo || e.startDate <= historyTo)),
    [entries, historyFrom, historyTo],
  );
  const filteredPayments = useMemo(
    () => payments.filter((p) => (!historyFrom || p.paidAt >= historyFrom) && (!historyTo || p.paidAt <= historyTo)),
    [payments, historyFrom, historyTo],
  );

  return (
    <DrawerShell title={member.fullName} sub={t(ROLE_LABEL_KEYS[member.role])} onClose={onClose}>
      {/* Récap congés */}
      <section>
        <h3 style={sectionTitle}>{t('staff.leaveSection')}</h3>
        {summary ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {t('staff.leaveBalance', { n: formatDays(summary.leaveBalanceDays) })}
            </div>
            <div style={{ color: 'var(--ink-3)' }}>
              {t('staff.leaveAccrued', { n: formatDays(summary.accruedLeaveDays), months: summary.monthsWorked })}
            </div>
            <div style={{ color: 'var(--ink-3)' }}>{t('staff.leaveTaken', { n: formatDays(summary.takenLeaveDays) })}</div>
            <div style={{ color: 'var(--ink-3)' }}>{t('staff.absences', { n: summary.absencesCount })}</div>
            <div style={{ color: 'var(--ink-3)' }}>{t('staff.lateness', { n: summary.latenessCount })}</div>
          </div>
        ) : (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('staff.loading')}</div>
        )}
      </section>

      {/* Filtre date range + exports — user request 2026-05-28 :
          rechercher historique salaires/absences/retards + exports. */}
      <section>
        <h3 style={sectionTitle}>{t('staff.history.title')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <DateField label={t('staff.history.from')} value={historyFrom} onChange={setHistoryFrom} />
          <DateField label={t('staff.history.to')} value={historyTo} onChange={setHistoryTo} />
        </div>
        {(historyFrom || historyTo) && (
          <button
            type="button"
            onClick={() => { setHistoryFrom(''); setHistoryTo(''); }}
            style={{
              marginTop: 6, background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11.5, padding: 0, color: 'var(--primary)', fontFamily: 'inherit',
            }}
          >
            {t('staff.history.reset')}
          </button>
        )}
      </section>

      {/* Liste des entrées congé/absence/retard */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={sectionTitle}>{t('staff.entries.title')}</h3>
          <button
            type="button"
            onClick={exportLeaves}
            disabled={filteredEntries.length === 0}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '4px 10px', cursor: filteredEntries.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 11.5, fontFamily: 'inherit', color: 'var(--primary)',
              opacity: filteredEntries.length === 0 ? 0.5 : 1,
            }}
          >
            {t('staff.exportCsv')}
          </button>
        </div>
        {filteredEntries.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{historyFrom || historyTo ? t('staff.entries.emptyPeriod') : t('staff.entries.empty')}</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredEntries.map((e) => (
              <li
                key={e.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6,
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 64 }}>{t(LEAVE_TYPE_LABEL_KEYS[e.type])}</span>
                <span className="tnum">{e.startDate}</span>
                <span style={{ color: 'var(--ink-3)' }}>{t('staff.entries.daysUnit', { n: formatDays(e.days) })}</span>
                {e.notes && <span style={{ color: 'var(--ink-3)', flex: 1 }}>{e.notes}</span>}
                <button
                  type="button"
                  onClick={() => { void handleDeleteLeave(e.id); }}
                  aria-label={t('staff.entries.deleteAria')}
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
            label={t('staff.entries.formType')}
            value={leaveForm.type}
            onChange={(v) => setLeaveForm({ ...leaveForm, type: v as LeaveType })}
            options={LEAVE_TYPE_ORDER.map((lt) => ({ value: lt, label: t(LEAVE_TYPE_LABEL_KEYS[lt]) }))}
          />
          <DateField
            label={t('staff.entries.formDate')}
            value={leaveForm.startDate}
            onChange={(v) => setLeaveForm({ ...leaveForm, startDate: v })}
          />
          <Field
            label={t('staff.entries.formDays')}
            value={leaveForm.days}
            onChange={(v) => setLeaveForm({ ...leaveForm, days: v.replace(/[^0-9.]/g, '') })}
            placeholder={t('staff.entries.formDaysPlaceholder')}
          />
          <Field
            label={t('staff.entries.formNotes')}
            value={leaveForm.notes}
            onChange={(v) => setLeaveForm({ ...leaveForm, notes: v })}
            placeholder={t('staff.entries.formNotesPlaceholder')}
          />
          <Button type="button" disabled={addingLeave} onClick={() => { void handleAddLeave(); }}>
            <Plus /> {t('staff.entries.addBtn')}
          </Button>
        </div>
      </section>

      {/* Paiements de salaire */}
      <section>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={sectionTitle}>{t('staff.payments.title')}</h3>
          <button
            type="button"
            onClick={exportPayments}
            disabled={filteredPayments.length === 0}
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 6,
              padding: '4px 10px', cursor: filteredPayments.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 11.5, fontFamily: 'inherit', color: 'var(--primary)',
              opacity: filteredPayments.length === 0 ? 0.5 : 1,
            }}
          >
            {t('staff.exportCsv')}
          </button>
        </div>
        {filteredPayments.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{historyFrom || historyTo ? t('staff.payments.emptyPeriod') : t('staff.payments.empty')}</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredPayments.map((p) => (
              <li
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13,
                  padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6,
                }}
              >
                <span className="tnum" style={{ fontWeight: 600, minWidth: 64 }}>{p.period}</span>
                <span className="tnum">{formatMad(p.amount)}</span>
                <span style={{ color: 'var(--ink-3)' }}>{t('staff.payments.paidOn')} <span className="tnum">{p.paidAt}</span></span>
                <button
                  type="button"
                  onClick={() => { void handleDeletePayment(p.id); }}
                  aria-label={t('staff.payments.deleteAria')}
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
            <span style={{ color: 'var(--ink-3)', fontWeight: 600 }}>{t('staff.payments.period')}</span>
            <input
              type="month"
              value={payForm.period}
              onChange={(e) => setPayForm({ ...payForm, period: e.target.value })}
              style={inputStyle}
            />
          </label>
          <Field
            label={t('staff.payments.amount')}
            value={payForm.amount}
            onChange={(v) => setPayForm({ ...payForm, amount: v.replace(/[^0-9.]/g, '') })}
            placeholder={t('staff.payments.amountPlaceholder')}
          />
          <DateField
            label={t('staff.payments.paidAt')}
            value={payForm.paidAt}
            onChange={(v) => setPayForm({ ...payForm, paidAt: v })}
          />
          <Field
            label={t('staff.payments.notes')}
            value={payForm.notes}
            onChange={(v) => setPayForm({ ...payForm, notes: v })}
            placeholder={t('staff.payments.notesPlaceholder')}
          />
          <Button type="button" disabled={addingPayment} onClick={() => { void handleAddPayment(); }}>
            <Plus /> {t('staff.payments.addBtn')}
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
  const { t } = useT();
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
            aria-label={t('staff.close')}
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
      <Select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    </label>
  );
}
