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
import { usePatientSearch } from './hooks/usePatientSearch';
import { useReasons } from './hooks/useReasons';
import { useAvailability } from './hooks/useAvailability';
import { useMonthAvailability } from './hooks/useMonthAvailability';
import { useCreateAppointment } from './hooks/useCreateAppointment';
import { useCreatePatient } from '@/features/dossier-patient/hooks/useCreatePatient';
import { rdvFormSchema } from './schema';
import { DURATION_OPTIONS } from './fixtures';
import type { RdvFormValues } from './types';
import './prise-rdv.css';

// ── Mini calendar ─────────────────────────────────────────────────────────────

const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

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
          aria-label="Mois précédent"
        >
          ‹
        </button>
        <span className="prise-rdv-cal-title">{MONTHS_FR[month]} {year}</span>
        <button type="button" className="prise-rdv-cal-nav" onClick={onNextMonth} aria-label="Mois suivant">
          ›
        </button>
      </div>
      <div className="prise-rdv-cal-grid" role="grid" aria-label="Calendrier">
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
                aria-label={`${day} ${MONTHS_FR[month] ?? ''} ${year}`}
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
      {isLoading && <div className="prise-rdv-cal-loading">Chargement…</div>}
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
  const { create, isPending } = useCreatePatient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'M' | 'F' | 'O'>('M');
  const [phone, setPhone] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  async function handleSave() {
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setValidationError('Prénom et nom requis (2 caractères min, lettres uniquement).');
      return;
    }
    if (!phone.trim() || !/^[\d\s+\-().]{6,20}$/.test(phone.trim())) {
      setValidationError('Téléphone requis (6-20 chiffres).');
      return;
    }
    try {
      const created = await create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gender,
        birthDate: '',
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
      toast.success('Patient créé.');
      onCreated(created.id, `${created.firstName} ${created.lastName}`);
    } catch {
      toast.error('Création patient refusée.');
    }
  }

  return (
    <div
      style={{
        marginTop: 8,
        padding: 14,
        border: '1px solid var(--primary)',
        background: 'var(--primary-soft)',
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10, color: 'var(--primary)' }}>
        Nouveau patient — informations minimales
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input
          placeholder="Prénom *"
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
          placeholder="Nom *"
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
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value as 'M' | 'F' | 'O')}
          style={{
            height: 34,
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '0 10px',
            fontSize: 13,
            fontFamily: 'inherit',
            background: 'var(--surface)',
          }}
        >
          <option value="M">Homme</option>
          <option value="F">Femme</option>
          <option value="O">Autre</option>
        </select>
        <input
          placeholder="Téléphone *"
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
      {validationError && (
        <div style={{ color: 'var(--danger)', fontSize: 11.5, marginBottom: 8 }}>
          {validationError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button type="button" size="sm" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={isPending}
          onClick={() => void handleSave()}
        >
          {isPending ? 'Création…' : 'Créer & sélectionner'}
        </Button>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto', alignSelf: 'center' }}>
          Vous pourrez compléter le dossier plus tard.
        </span>
      </div>
    </div>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────────

export interface PriseRDVDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function PriseRDVDialog({ open, onOpenChange, onCreated }: PriseRDVDialogProps) {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string | null>(null);
  const [selectedReasonId, setSelectedReasonId] = useState<string | null>(null);
  const [patientError, setPatientError] = useState<string | null>(null);
  const [showNewPatientForm, setShowNewPatientForm] = useState(false);

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();

  const [calYear, setCalYear] = useState(yyyy);
  const [calMonth, setCalMonth] = useState(today.getMonth());

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm<RdvFormValues>({
    resolver: zodResolver(rdvFormSchema),
    defaultValues: {
      patientId: null,
      patientQuery: '',
      date: `${dd}/${mm}/${yyyy}`,
      time: '',
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
  const { availableDates, isLoading: isLoadingDates } = useMonthAvailability(calYear, calMonth, durationMin);
  const { slots, isLoading: isLoadingSlots } = useAvailability(dateValue, durationMin);

  useEffect(() => {
    if (reasons.length > 0 && selectedReasonId === null) {
      setSelectedReasonId(reasons[0]?.id ?? null);
    }
  }, [reasons, selectedReasonId]);

  const { createAppointment, isPending, error } = useCreateAppointment();

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
      setPatientError('Veuillez sélectionner un patient.');
      return;
    }
    const result = await createAppointment({
      patientId: selectedPatientId,
      date: data.date,
      time: data.time,
      durationMin: data.durationMin,
      reasonId: selectedReasonId,
      ...(data.notes ? { notes: data.notes } : {}),
    }).catch(() => null);
    if (result) {
      onCreated?.();
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
                Nouveau rendez-vous
              </Dialog.Title>
              <Dialog.Description className="prise-rdv-header-sub">
                Renseigner le patient et le créneau — le RDV sera ajouté à l&apos;agenda
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" iconOnly aria-label="Fermer" style={{ marginLeft: 'auto' }}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          {/* Scrollable body */}
          <form onSubmit={(e) => { void handleSubmit(onSubmit)(e); }}>
            <div className="prise-rdv-body scroll">

              {/* Step 1: Patient */}
              <div style={{ marginBottom: 18 }}>
                <div className="prise-rdv-step-label">Étape 1 · Patient</div>

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
                      Changer
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
                        placeholder="Nom, téléphone ou CIN…"
                        aria-label="Rechercher un patient"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => setShowNewPatientForm((v) => !v)}
                      >
                        <Plus /> {showNewPatientForm ? 'Fermer' : 'Nouveau'}
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
                      <div className="prise-rdv-candidates" role="listbox" aria-label="Résultats patients">
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
                                {s.phone} · Dernière visite : {s.lastVisit}
                              </div>
                            </div>
                            {s.tags.map((t) => (
                              <span key={t} className="pill">{t}</span>
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
                <div className="prise-rdv-step-label">Étape 2 · Créneau</div>
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
                      <FieldLabel htmlFor="rdv-dur">Durée</FieldLabel>
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
                              <option key={d.value} value={d.value}>{d.label}</option>
                            ))}
                          </Select>
                        )}
                      />
                    </Field>
                    <div className="prise-rdv-slots-label">Créneaux disponibles</div>
                    {isLoadingSlots ? (
                      <div className="prise-rdv-slots-empty">Chargement…</div>
                    ) : slots.length === 0 ? (
                      <div className="prise-rdv-slots-empty">
                        {dateValue ? 'Aucun créneau disponible ce jour' : 'Sélectionnez une date'}
                      </div>
                    ) : (
                      <div className="prise-rdv-slots" role="group" aria-label="Créneaux disponibles">
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
                      <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 6 }}>{errors.date.message}</div>
                    )}
                    {errors.time && (
                      <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{errors.time.message}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 3: Motif */}
              <div>
                <div className="prise-rdv-step-label">Étape 3 · Motif</div>
                <Field style={{ marginBottom: 10 }}>
                  <FieldLabel>Type</FieldLabel>
                  <div className="prise-rdv-reason-btns" role="group" aria-label="Type de consultation">
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
                  <FieldLabel htmlFor="rdv-notes">Note pour le médecin (facultatif)</FieldLabel>
                  <Textarea
                    id="rdv-notes"
                    {...register('notes')}
                    placeholder="Ex. Apporter carnet de vaccination, résultats de la dernière prise de sang, etc."
                  />
                </Field>
              </div>
            </div>

            {/* Footer */}
            <div className="prise-rdv-footer">
              <label className="prise-rdv-sms-label">
                <input type="checkbox" {...register('sendSms')} defaultChecked />
                Envoyer un SMS de confirmation
              </label>
              {error && (
                <div style={{ color: 'var(--danger)', fontSize: 12, marginTop: 4 }}>{error}</div>
              )}
              <div className="prise-rdv-footer-actions">
                <Dialog.Close asChild>
                  <Button type="button">Annuler</Button>
                </Dialog.Close>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? 'Enregistrement…' : 'Confirmer le RDV'}
                </Button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
