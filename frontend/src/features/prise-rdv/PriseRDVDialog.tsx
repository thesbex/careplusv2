/**
 * Screen 02 — Prise de RDV (desktop).
 * Ported from design/prototype/screens/prise-rdv.jsx verbatim.
 *
 * Radix Dialog wraps the form — provides keyboard navigation, focus trap,
 * Escape to close, and WAI-ARIA roles (ADR-015: Radix for a11y affordances).
 */
import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Select, Textarea } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { Close, Search, Plus } from '@/components/icons';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/I18nProvider';
import { useAuthStore } from '@/lib/auth/authStore';
import { usePatientSearch } from './hooks/usePatientSearch';
import { useReasons } from './hooks/useReasons';
import { useAvailability } from './hooks/useAvailability';
import { useMonthAvailability } from './hooks/useMonthAvailability';
import { useCreateAppointment } from './hooks/useCreateAppointment';
import { useCreatePatient } from '@/features/dossier-patient/hooks/useCreatePatient';
import { usePractitioners } from '@/features/agenda/hooks/usePractitioners';
import { useRooms } from '@/features/agenda/hooks/useRooms';
import { rdvFormSchema } from './schema';
import { DURATION_OPTIONS } from './fixtures';
import type { RdvFormValues } from './types';
import './prise-rdv.css';

// ── Mini calendar ─────────────────────────────────────────────────────────────

// Single-letter weekday headers (Mon→Sun). Kept as locale-neutral initials —
// the prototype uses the same compact column heads regardless of language.
const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

interface MiniCalProps {
  year: number;
  month: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  value: string; // JJ/MM/AAAA
  onChange: (v: string) => void;
  availableDates: Set<string>;
  isLoading: boolean;
}

function MiniCal({ year, month, onPrevMonth, onNextMonth, value, onChange, availableDates, isLoading }: MiniCalProps) {
  const { t } = useT();
  const monthLabel = t(`rdv.month.${month}`);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const canGoPrev = year > todayDate.getFullYear() || (year === todayDate.getFullYear() && month > todayDate.getMonth());

  const selectedIso = /^\d{2}\/\d{2}\/\d{4}$/.test(value)
    ? `${value.slice(6)}-${value.slice(3, 5)}-${value.slice(0, 2)}`
    : null;

  const cells: (number | null)[] = [
    ...Array<null>(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="prise-rdv-cal">
      <div className="prise-rdv-cal-header">
        <button
          type="button"
          className="prise-rdv-cal-nav"
          onClick={onPrevMonth}
          disabled={!canGoPrev}
          aria-label={t('rdv.cal.prevMonth')}
        >
          ‹
        </button>
        <span className="prise-rdv-cal-title">{monthLabel} {year}</span>
        <button type="button" className="prise-rdv-cal-nav" onClick={onNextMonth} aria-label={t('rdv.cal.nextMonth')}>
          ›
        </button>
      </div>
      <div className="prise-rdv-cal-grid" role="grid" aria-label={t('rdv.cal.aria')}>
        {WEEKDAYS_SHORT.map((d, i) => (
          <div key={i} className="prise-rdv-cal-weekday" role="columnheader">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`e${i}`} className="prise-rdv-cal-empty" role="gridcell" />;
          const isoDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const cellDate = new Date(year, month, day);
          const isPast = cellDate < todayDate;
          const hasSlots = availableDates.has(isoDate);
          const isSelected = isoDate === selectedIso;
          const isToday = cellDate.getTime() === todayDate.getTime();
          const disabled = isPast || (!isLoading && !hasSlots);
          return (
            <div key={day} role="gridcell">
              <button
                type="button"
                disabled={disabled}
                aria-label={t('rdv.cal.dayAria', { day, month: monthLabel, year })}
                aria-pressed={isSelected}
                className={[
                  'prise-rdv-cal-day',
                  isSelected ? 'selected' : '',
                  isToday && !isSelected ? 'today' : '',
                  disabled ? 'disabled' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => {
                  const dd = String(day).padStart(2, '0');
                  const mm = String(month + 1).padStart(2, '0');
                  onChange(`${dd}/${mm}/${year}`);
                }}
              >
                {day}
              </button>
            </div>
          );
        })}
      </div>
      {isLoading && <div className="prise-rdv-cal-loading">{t('rdv.cal.loading')}</div>}
    </div>
  );
}

// ── Inline new patient mini-form ──────────────────────────────────────────────

interface NewPatientInlineProps {
  onCreated: (id: string, name: string) => void;
  onCancel: () => void;
}

function sanitizeName(v: string) {
  return v.replace(/[^a-zA-ZÀ-ÿ؀-ۿ\s'\-]/g, '');
}

function NewPatientInline({ onCreated, onCancel }: NewPatientInlineProps) {
  const { t } = useT();
  const { create, isPending } = useCreatePatient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSave() {
    setValidationError(null);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setValidationError(t('rdv.newPatient.err.names'));
      return;
    }
    if (!phone.trim() || !/^[\d\s+\-().]{6,20}$/.test(phone.trim())) {
      setValidationError(t('rdv.newPatient.err.phone'));
      return;
    }
    if (!birthDate) {
      setValidationError(t('rdv.newPatient.err.birthRequired'));
      return;
    }
    if (birthDate > new Date().toISOString().slice(0, 10)) {
      setValidationError(t('rdv.newPatient.err.birthFuture'));
      return;
    }
    try {
      const created = await create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        birthDate,
        cin: '',
        phone: phone.trim(),
        email: '',
        city: '',
        bloodGroup: '',
        notes: '',
        tier: 'NORMAL',
        hasMutuelle: false,
        mutuelleInsuranceId: '',
        mutuellePolicyNumber: '',
        allergies: [],
        antecedents: [],
      });
      toast.success(t('rdv.newPatient.toast.created'));
      onCreated(created.id, `${created.firstName} ${created.lastName}`);
    } catch (err) {
      // Surface the real backend reason (CIN duplicate, validation message,
      // etc.) instead of a vague "creation refused" toast that hides why
      // the patient ends up not selected at confirm time.
      const detail =
        (err as { response?: { data?: { message?: string; detail?: string } } })?.response?.data
          ?.message ??
        (err as { response?: { data?: { message?: string; detail?: string } } })?.response?.data
          ?.detail ??
        (err as Error)?.message ??
        t('rdv.newPatient.err.serverFallback');
      setValidationError(detail);
      toast.error(t('rdv.newPatient.toast.failed'), { description: detail });
      // eslint-disable-next-line no-console
      console.error('[NewPatientInline] create failed', err);
    }
  }

  // Pressing Enter inside the mini-form must NOT submit the parent RDV form
  // (which would surface "Veuillez sélectionner un patient" if the patient
  // isn't created yet). Intercept Enter and trigger handleSave instead.
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      void handleSave();
    }
  }

  return (
    <div
      onKeyDown={onKeyDown}
      style={{
        marginTop: 8,
        padding: 14,
        border: '1px solid var(--primary)',
        background: 'var(--primary-soft)',
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--primary)' }}>
        {t('rdv.newPatient.title')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input
          placeholder={t('rdv.newPatient.firstName')}
          value={firstName}
          onChange={(e) => {
            setFirstName(sanitizeName(e.target.value));
            setValidationError(null);
          }}
          style={{
            height: 34,
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'var(--surface)',
          }}
          autoFocus
        />
        <input
          placeholder={t('rdv.newPatient.lastName')}
          value={lastName}
          onChange={(e) => {
            setLastName(sanitizeName(e.target.value));
            setValidationError(null);
          }}
          style={{
            height: 34,
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'var(--surface)',
          }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 8, marginBottom: 8 }}>
        <Select
          value={gender}
          onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'O')}
        >
          <option value="M">{t('rdv.newPatient.gender.M')}</option>
          <option value="F">{t('rdv.newPatient.gender.F')}</option>
          <option value="O">{t('rdv.newPatient.gender.O')}</option>
        </Select>
        <input
          placeholder={t('rdv.newPatient.phone')}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value.replace(/[^\d\s+\-().]/g, ''));
            setValidationError(null);
          }}
          inputMode="tel"
          style={{
            height: 34,
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'var(--surface)',
          }}
        />
      </div>
      <div style={{ marginBottom: 8 }}>
        <input
          type="date"
          value={birthDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            setBirthDate(e.target.value);
            setValidationError(null);
          }}
          aria-label={t('rdv.newPatient.birthDate')}
          style={{
            width: '100%',
            height: 34,
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'var(--surface)',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
          {t('rdv.newPatient.birthDateLabel')}
        </div>
      </div>
      {validationError && (
        <div style={{ color: 'var(--danger)', fontSize: 11.5, marginBottom: 8 }}>
          {validationError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="button" size="sm" onClick={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() => void handleSave()}
        >
          {isPending ? t('rdv.newPatient.creating') : t('rdv.newPatient.createSelect')}
        </Button>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto', alignSelf: 'center' }}>
          {t('rdv.newPatient.completeLater')}
        </span>
      </div>
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export interface PriseRDVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful create. `createdDate` is the booked day in
   *  ISO yyyy-MM-dd so the caller can navigate to the right week (otherwise
   *  a RDV booked outside the visible week silently appears off-screen). */
  onCreated?: (createdDate?: string) => void;
  /** ISO yyyy-MM-dd to pre-select in the calendar (e.g. when opened from an empty agenda slot). */
  prefilledDate?: string;
  /** "HH:mm" to pre-select as the time (used together with prefilledDate). */
  prefilledTime?: string;
}

export function PriseRDVDialog({
  open,
  onOpenChange,
  onCreated,
  prefilledDate,
  prefilledTime,
}: PriseRDVDialogProps) {
  const { t } = useT();
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  // Wave 1 (2026-05-07): auto-adaptive practitioner + room.
  const currentUser = useAuthStore((s) => s.user);
  const { data: practitioners } = usePractitioners();
  const { data: rooms } = useRooms();
  const activePractitioners = practitioners.filter((p) => p.active);
  const activeRooms = rooms.filter((r) => r.active);
  const showPractitionerField = activePractitioners.length >= 2;
  const showRoomField = activeRooms.length >= 2;

  // Default practitioner: connected user if MEDECIN, else first active.
  const isMedecin = currentUser?.roles?.includes('MEDECIN') ?? false;
  const defaultPractitionerId =
    isMedecin && currentUser?.id
      ? currentUser.id
      : activePractitioners[0]?.id ?? '';
  const [practitionerId, setPractitionerId] = useState<string>(defaultPractitionerId);
  const [roomId, setRoomId] = useState<string>(''); // '' = no room

  useEffect(() => {
    // Re-sync default once practitioners load.
    if (!practitionerId && defaultPractitionerId) {
      setPractitionerId(defaultPractitionerId);
    }
  }, [defaultPractitionerId, practitionerId]);

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();

  // Prefilled date/time take precedence when the dialog is opened from a
  // click on an empty agenda slot. Convert the ISO yyyy-MM-dd into the
  // dd/MM/yyyy format the existing form uses.
  const initialDate = (() => {
    if (!prefilledDate) return `${dd}/${mm}/${yyyy}`;
    const [Y, M, D] = prefilledDate.split('-');
    return `${D}/${M}/${Y}`;
  })();
  const initialDateObj = prefilledDate ? new Date(`${prefilledDate}T00:00:00`) : today;

  const [calYear, setCalYear] = useState(initialDateObj.getFullYear());
  const [calMonth, setCalMonth] = useState(initialDateObj.getMonth());

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<RdvFormValues>({
    resolver: zodResolver(rdvFormSchema),
    defaultValues: {
      patientId: null,
      patientQuery: '',
      date: initialDate,
      time: prefilledTime ?? '',
      durationMin: 20,
      reasonId: null,
      notes: '',
      sendSms: true,
    },
  });

  const patientQuery = watch('patientQuery');
  const durationMin = watch('durationMin');
  const dateValue = watch('date');

  const { candidates } = usePatientSearch(patientQuery);
  const { reasons } = useReasons();
  // Pass the form's selected practitioner explicitly. Without this, a
  // secrétaire's mini-agenda was greyed out (the hook fell back to her own
  // user id, which has no slots).
  const { availableDates, isLoading: isLoadingDates } =
    useMonthAvailability(calYear, calMonth, durationMin, practitionerId);
  const { slots, isLoading: isLoadingSlots } =
    useAvailability(dateValue, durationMin, practitionerId);

  useEffect(() => {
    if (reasons.length > 0 && selectedReasonId === null) {
      setSelectedReasonId(reasons[0]?.id ?? null);
    }
  }, [reasons, selectedReasonId]);

  const { createAppointment, isPending, error } = useCreateAppointment();

  /**
   * Probe room-conflicts after a successful create. Backend never blocks;
   * the warning is surfaced as a toast and the dialog still closes.
   */
  async function probeAndWarnRoomConflicts(appointmentId: string): Promise<void> {
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/room-conflicts`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          ...(useAuthStore.getState().accessToken
            ? { Authorization: `Bearer ${useAuthStore.getState().accessToken}` }
            : {}),
        },
      });
      if (!res.ok) return;
      const conflicts = (await res.json()) as Array<{
        conflictPractitionerLastName: string;
        conflictStartAt: string;
        conflictEndAt: string;
      }>;
      if (conflicts.length === 0) return;
      const first = conflicts[0];
      const time = first
        ? `${new Date(first.conflictStartAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}-${new Date(first.conflictEndAt).toLocaleTimeString('fr-FR', {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : '';
      const dr = first ? `Dr ${first.conflictPractitionerLastName}` : '';
      const many = conflicts.length > 1;
      toast.warning(
        t(many ? 'rdv.roomConflict.many' : 'rdv.roomConflict.one', {
          count: conflicts.length,
          dr,
          time,
        }),
      );
    } catch {
      // silent — conflict probe failure must not break the create flow.
    }
  }

  function handlePrevMonth() {
    if (calMonth === 0) { setCalMonth(11); setCalYear((y) => y - 1); }
    else setCalMonth((m) => m - 1);
  }

  function handleNextMonth() {
    if (calMonth === 11) { setCalMonth(0); setCalYear((y) => y + 1); }
    else setCalMonth((m) => m + 1);
  }

  async function onSubmit(data: RdvFormValues) {
    if (!selectedPatientId) {
      setPatientError(t('rdv.err.selectPatient'));
      return;
    }
    const result = await createAppointment({
      patientId: selectedPatientId,
      date: data.date,
      time: data.time,
      durationMin: data.durationMin,
      reasonId: selectedReasonId,
      ...(data.notes ? { notes: data.notes } : {}),
      ...(showPractitionerField && practitionerId ? { practitionerId } : {}),
      // null roomId = explicit "no room"; only send when field is visible.
      ...(showRoomField ? { roomId: roomId || null } : {}),
    }).catch(() => null);
    if (result) {
      // Probe room conflicts after success when a room was assigned. Warning
      // only — never blocks the close path.
      if (showRoomField && roomId) {
        void probeAndWarnRoomConflicts(result.id);
      }
      // Convert JJ/MM/AAAA → yyyy-MM-dd for the parent's week-nav math.
      const [dd, mm, yyyy] = data.date.split('/');
      const isoDate = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : undefined;
      onCreated?.(isoDate);
      onOpenChange(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="prise-rdv-overlay" />
        <Dialog.Content className="prise-rdv-dialog">
          {/* Header */}
          <div className="prise-rdv-header">
            <div>
              <Dialog.Title className="prise-rdv-header-title">
                {t('rdv.title')}
              </Dialog.Title>
              <Dialog.Description className="prise-rdv-header-sub">
                {t('rdv.subtitle')}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" iconOnly aria-label={t('common.close')} style={{ marginLeft: 'auto' }}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <form
            className="prise-rdv-form"
            onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}
          >
            <div className="prise-rdv-body scroll">

              {/* Step 1: Patient */}
              <div style={{ marginBottom: 18 }}>
                <div className="prise-rdv-step-label">{t('rdv.step1')}</div>

                {selectedPatientId && selectedPatientName ? (
                  /* ── Selected patient card ── */
                  <div className="prise-rdv-selected-patient">
                    <Avatar
                      initials={selectedPatientName.split(' ').map((x) => x[0]).slice(0, 2).join('')}
                      size="sm"
                    />
                    <span className="prise-rdv-selected-name">{selectedPatientName}</span>
                    <button
                      type="button"
                      className="prise-rdv-change-btn"
                      onClick={() => {
                        setSelectedPatientId(null);
                        setSelectedPatientName(null);
                        setValue('patientQuery', '');
                      }}
                    >
                      {t('rdv.change')}
                    </button>
                  </div>
                ) : (
                  /* ── Search + candidates ── */
                  <>
                    <div className="prise-rdv-search">
                      <Search />
                      <input
                        {...register('patientQuery')}
                        className="prise-rdv-search-input"
                        placeholder={t('rdv.searchPlaceholder')}
                        aria-label={t('rdv.searchAria')}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => setShowNewPatientForm((v) => !v)}
                      >
                        <Plus /> {showNewPatientForm ? t('common.close') : t('rdv.newPatientBtn')}
                      </Button>
                    </div>

                    {showNewPatientForm && (
                      <NewPatientInline
                        onCreated={(id, name) => {
                          setSelectedPatientId(id);
                          setSelectedPatientName(name);
                          setShowNewPatientForm(false);
                          setPatientError(null);
                          setValue('patientQuery', '');
                        }}
                        onCancel={() => setShowNewPatientForm(false)}
                      />
                    )}

                    {patientError && (
                      <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{patientError}</div>
                    )}
                    {!showNewPatientForm && candidates.length > 0 && (
                      <div className="prise-rdv-candidates" role="listbox" aria-label={t('rdv.candidatesAria')}>
                        {candidates.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            role="option"
                            aria-selected={selectedPatientId === s.id}
                            className="prise-rdv-candidate-row"
                            onClick={() => {
                              setSelectedPatientId(s.id);
                              setSelectedPatientName(s.name);
                              setPatientError(null);
                            }}
                          >
                            <Avatar initials={s.name.split(' ').map((x) => x[0]).slice(0, 2).join('')} size="sm" />
                            <div style={{ flex: 1 }}>
                              <div className="prise-rdv-candidate-name">{s.name}</div>
                              <div className="prise-rdv-candidate-meta">
                                {s.phone} · {t('rdv.lastVisit', { date: s.lastVisit })}
                              </div>
                            </div>
                            {typeof s.ageYears === 'number' && (
                              <span className="pill">{t('rdv.years', { n: s.ageYears })}</span>
                            )}
                            {s.tags.map((tag) => (
                              <span key={tag} className="pill">{tag}</span>
                            ))}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Step 2: Créneau */}
              <div style={{ marginBottom: 18 }}>
                <div className="prise-rdv-step-label">{t('rdv.step2')}</div>
                <div className="prise-rdv-creneau-layout">
                  <MiniCal
                    year={calYear}
                    month={calMonth}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                    value={dateValue}
                    onChange={(v) => { setValue('date', v); setValue('time', ''); }}
                    availableDates={availableDates}
                    isLoading={isLoadingDates}
                  />
                  <div className="prise-rdv-creneau-right">
                    <Field style={{ marginBottom: 12 }}>
                      <FieldLabel htmlFor="rdv-dur">{t('rdv.duration')}</FieldLabel>
                      <Controller
                        name="durationMin"
                        control={control}
                        render={({ field }) => (
                          <Select
                            id="rdv-dur"
                            value={field.value}
                            onChange={(e) => { field.onChange(Number(e.target.value)); setValue('time', ''); }}
                          >
                            {DURATION_OPTIONS.map((d) => (
                              <option key={d.value} value={d.value}>{t('rdv.dur.minutes', { n: d.value })}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </Field>
                    <div className="prise-rdv-slots-label">{t('rdv.slots')}</div>
                    {isLoadingSlots ? (
                      <div className="prise-rdv-slots-empty">{t('rdv.slotsLoading')}</div>
                    ) : slots.length === 0 ? (
                      <div className="prise-rdv-slots-empty">
                        {dateValue ? t('rdv.slotsEmptyDay') : t('rdv.slotsPickDate')}
                      </div>
                    ) : (
                      <div className="prise-rdv-slots" role="group" aria-label={t('rdv.slotsAria')}>
                        {slots.map((s) => (
                          <button
                            key={s.time}
                            type="button"
                            aria-pressed={watch('time') === s.time}
                            className={`prise-rdv-slot-btn${watch('time') === s.time ? ' selected' : ''}`}
                            onClick={() => setValue('time', s.time)}
                          >
                            {s.time}
                          </button>
                        ))}
                      </div>
                    )}
                    {errors.date && (
                      <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{t(errors.date.message ?? '')}</div>
                    )}
                    {errors.time && (
                      <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{t(errors.time.message ?? '')}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Optional auto-adaptive selectors: practitioner + room */}
              {(showPractitionerField || showRoomField) && (
                <div style={{ marginBottom: 18 }}>
                  <div className="prise-rdv-step-label">
                    {showPractitionerField && showRoomField
                      ? t('rdv.practitionerAndRoom')
                      : showPractitionerField
                        ? t('rdv.practitioner')
                        : t('rdv.room')}
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        showPractitionerField && showRoomField ? '1fr 1fr' : '1fr',
                      gap: 12,
                    }}
                  >
                    {showPractitionerField && (
                      <Field>
                        <FieldLabel htmlFor="rdv-practitioner">{t('rdv.practitioner')}</FieldLabel>
                        <Select
                          id="rdv-practitioner"
                          aria-label={t('rdv.practitioner')}
                          value={practitionerId}
                          onChange={(e) => setPractitionerId(e.target.value)}
                        >
                          <option value="" disabled>
                            {t('rdv.pickPractitioner')}
                          </option>
                          {activePractitioners.map((p) => (
                            <option key={p.id} value={p.id}>
                              Dr {p.lastName} {p.firstName}
                              {p.specialty ? ` — ${p.specialty}` : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                    {showRoomField && (
                      <Field>
                        <FieldLabel htmlFor="rdv-room">{t('rdv.room')}</FieldLabel>
                        <Select
                          id="rdv-room"
                          aria-label={t('rdv.room')}
                          value={roomId}
                          onChange={(e) => setRoomId(e.target.value)}
                        >
                          <option value="">{t('rdv.noRoom')}</option>
                          {activeRooms.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                              {r.capabilityTags.length > 0
                                ? ` (${r.capabilityTags.join(', ')})`
                                : ''}
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Motif */}
              <div>
                <div className="prise-rdv-step-label">{t('rdv.step3')}</div>
                <Field style={{ marginBottom: 10 }}>
                  <FieldLabel>{t('rdv.type')}</FieldLabel>
                  <div className="prise-rdv-reason-btns" role="group" aria-label={t('rdv.typeAria')}>
                    {reasons.map((r) => {
                      const isSelected = selectedReasonId === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className="btn sm"
                          aria-pressed={isSelected}
                          onClick={() => setSelectedReasonId(r.id)}
                          style={{
                            background: isSelected ? 'var(--primary-soft)' : 'var(--surface)',
                            borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                            color: isSelected ? 'var(--primary)' : 'var(--ink)',
                            fontWeight: isSelected ? 600 : 500,
                          }}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field>
                  <FieldLabel htmlFor="rdv-notes">{t('rdv.noteLabel')}</FieldLabel>
                  <Textarea
                    id="rdv-notes"
                    {...register('notes')}
                    placeholder={t('rdv.notePlaceholder')}
                  />
                </Field>
              </div>
            </div>

            {/* Footer */}
            <div className="prise-rdv-footer">
              <label className="prise-rdv-sms-label">
                <input type="checkbox" {...register('sendSms')} defaultChecked />
                {t('rdv.sendSms')}
              </label>
              {error && (
                <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{t(error)}</div>
              )}
              <div className="prise-rdv-footer-actions">
                <Dialog.Close asChild>
                  <Button type="button">{t('common.cancel')}</Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? t('rdv.submitting') : t('rdv.confirm')}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
