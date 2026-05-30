/**
 * Screen 05 — Prise des constantes (desktop).
 * Ported from design/prototype/screens/prise-constantes.jsx verbatim.
 *
 * Layout: left scrollable form (3 étapes) + 360px right reference panel.
 * Shell: <Screen active="salle"> — this flow is part of the assistant's
 * waiting-room loop.
 *
 * Backend dependency: J5 vitals module — currently uses fixture defaults
 * and a mock submission via useRecordVitals.
 * TODO(backend:J5): swap useRecordVitals to real mutation POSTing
 *   /api/appointments/:appointmentId/vitals
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Panel } from '@/components/ui/Panel';
import { Field } from '@/components/ui/Field';
import { Input, Textarea } from '@/components/ui/Input';
import { Heart, Clock } from '@/components/icons';
import { VitalFieldLarge } from './components/VitalFieldLarge';
import { PreviousVitalsCard } from './components/PreviousVitalsCard';
import { useRecordVitals } from './hooks/useRecordVitals';
import { useAppointment } from './hooks/useAppointment';
import { usePatient } from '@/features/dossier-patient/hooks/usePatient';
import { useT } from '@/lib/i18n/I18nProvider';
import { vitalsFormSchema, translateVitalsError, type VitalsFormValues } from './schema';
import './prise-constantes.css';

/**
 * Empty form values — the medic must enter every measurement themselves.
 * Pre-filling with realistic-looking defaults (TA 132/84, IMC 23.4, etc.) is a
 * safety hazard: the medic submits without realizing the values were never
 * confirmed for this patient. See audit 2026-05-01, IHM QA.
 */
const EMPTY_VITALS: VitalsFormValues = {
  tensionSys: null,
  tensionDia: null,
  pulse: null,
  spo2: null,
  tempC: null,
  weightKg: null,
  heightCm: null,
  glycemia: null,
  abdominalCm: null,
  respRate: null,
  headCircumferenceCm: null,
  notes: '',
  jeun: false,
  carnet: false,
  analyses: false,
};

export default function PriseConstantesPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const { submit, isPending } = useRecordVitals(appointmentId);
  const { appointment, isLoading: aptLoading, error: aptError } = useAppointment(appointmentId);
  const { patient, isLoading: patLoading, error: patError } = usePatient(appointment?.patientId);

  const aptTime = appointment
    ? new Date(appointment.startAt).toLocaleTimeString('fr-MA', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  const patientSub = patient
    ? t('vitals.patientSub', { name: patient.fullName, age: patient.age, time: aptTime })
    : t('common.loading');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsFormSchema),
    defaultValues: EMPTY_VITALS,
  });

  const weightKg   = watch('weightKg');
  const heightCm   = watch('heightCm');
  const tensionSys = watch('tensionSys');

  /** BMI = kg / (m²), rounded to 1 decimal. Prototype displays 23.4. */
  const bmi =
    weightKg && heightCm && heightCm > 0
      ? (weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)
      : '—';

  /** Mirror prototype warn logic: TA card turns amber when sys >= 130. */
  const taWarn = typeof tensionSys === 'number' && tensionSys >= 130;

  const onSubmit = handleSubmit(
    async (values) => {
      try {
        await submit(values);
        navigate('/salle');
      } catch (err) {
        // Surface API errors as a toast so the user knows why nothing happened.
        // mutateAsync throws an AxiosError when the backend returns 4xx/5xx;
        // without this catch the exception escapes silently and navigate() is
        // never called — the "rien ne se passe" bug (2026-05-02).
        const axiosMsg =
          (err as { response?: { data?: { detail?: string; message?: string } } })
            ?.response?.data?.detail ??
          (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ??
          null;
        toast.error(t('vitals.toast.saveError'), {
          description: axiosMsg ?? t('vitals.toast.saveErrorDesc'),
        });
      }
    },
    (errs) => {
      const first = Object.values(errs)[0] as { message?: string } | undefined;
      const root = (errs as { root?: { message?: string } }).root;
      toast.error(t('vitals.toast.invalid'), {
        description:
          translateVitalsError(root?.message, t) ??
          translateVitalsError(first?.message, t) ??
          t('vitals.toast.invalidDesc'),
      });
    },
  );

  // Hard gate: never render the form when the patient context is missing or
  // failed to load. Showing a half-loaded form means the medic could record
  // vitals while looking at stale / wrong / fixture data.
  const navMap = {
    dashboard:    '/dashboard',
    agenda:       '/agenda',
    patients:     '/patients',
    salle:        '/salle',
    consult:      '/consultations',
    factu:        '/facturation',
    vaccinations: '/vaccinations',
    grossesses:   '/grossesses',
    stock: '/stock',
    queueLab: '/queue/lab',
    queueRadio: '/queue/radio',
    messages: '/messages',
    catalogue:    '/catalogue',
    params:       '/parametres',
  } as const;
  if (aptError || patError) {
    return (
      <Screen
        active="salle"
        title={t('vitals.title')}
        sub={t('vitals.loadFailedSub')}
        onNavigate={(id) => navigate(navMap[id])}
      >
        <div role="alert" style={{ padding: 24, color: 'var(--danger)', fontSize: 14 }}>
          {aptError ?? patError}
          <div style={{ marginTop: 12 }}>
            <button type="button" onClick={() => navigate('/salle')} className="btn">
              {t('vitals.backToWaiting')}
            </button>
          </div>
        </div>
      </Screen>
    );
  }
  if (aptLoading || patLoading || !appointment || !patient) {
    return (
      <Screen
        active="salle"
        title={t('vitals.title')}
        sub={t('common.loading')}
        onNavigate={(id) => navigate(navMap[id])}
      >
        <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{t('vitals.loadingPatient')}</div>
      </Screen>
    );
  }

  // From here on, patient + appointment are real — never fixture.
  const patientCardData = {
    initials: patient.initials,
    fullName: patient.fullName,
    meta: t('vitals.patientMeta', { age: patient.age, sex: patient.sex, time: aptTime }),
  };

  return (
    <Screen
      active="salle"
      title={t('vitals.title')}
      sub={patientSub}
      onNavigate={(id) => navigate(navMap[id])}
    >
      <form onSubmit={onSubmit} noValidate className="pc-layout">

        {/* ── Left — form ─────────────────────────────────────── */}
        <div className="pc-left scroll">
          <div className="pc-left-inner">

            {/* Étape 1 · Mesures */}
            <div className="pc-section">
              <div className="pc-step-h">{t('vitals.step1')}</div>
              <div className="pc-vitals-grid">

                {/* Tension artérielle — composite card (SYS / DIA) */}
                <Panel style={{ padding: '12px 14px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      color: taWarn ? 'var(--amber)' : 'var(--primary)',
                    }}
                  >
                    <Heart />
                    <span style={{ fontSize: 11.5, color: 'var(--ink-2)', fontWeight: 550 }}>
                      {t('vitals.ta')}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 4,
                      marginTop: 8,
                    }}
                  >
                    <input
                      className="input tnum"
                      type="number"
                      aria-label={t('vitals.taSys')}
                      style={{
                        height: 44,
                        fontSize: 24,
                        fontWeight: 500,
                        padding: '0 10px',
                        width: '45%',
                        borderColor: taWarn
                          ? 'var(--amber)'
                          : errors.tensionSys
                          ? 'var(--danger)'
                          : 'var(--border)',
                        background: taWarn ? 'var(--amber-soft)' : 'var(--surface)',
                      }}
                      {...register('tensionSys', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
                    />
                    <span style={{ fontSize: 16, color: 'var(--ink-3)', padding: '0 2px' }}>/</span>
                    <input
                      className="input tnum"
                      type="number"
                      aria-label={t('vitals.taDia')}
                      style={{
                        height: 44,
                        fontSize: 24,
                        fontWeight: 500,
                        padding: '0 10px',
                        width: '45%',
                        borderColor: taWarn
                          ? 'var(--amber)'
                          : errors.tensionDia
                          ? 'var(--danger)'
                          : 'var(--border)',
                        background: taWarn ? 'var(--amber-soft)' : 'var(--surface)',
                      }}
                      {...register('tensionDia', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
                    />
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>mmHg</span>
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: taWarn ? 'var(--amber)' : 'var(--ink-3)',
                      marginTop: 4,
                    }}
                  >
                    {translateVitalsError(errors.tensionSys?.message, t) ??
                      translateVitalsError(errors.tensionDia?.message, t) ??
                      t('vitals.taRange')}
                  </div>
                </Panel>

                {/* Fréquence cardiaque */}
                <VitalFieldLarge
                  icon="Heart"
                  label={t('vitals.fc')}
                  unit="bpm"
                  norm={t('vitals.fcRange')}
                  type="number"
                  aria-label={t('vitals.fc')}
                  errorMessage={translateVitalsError(errors.pulse?.message, t)}
                  {...register('pulse', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
                />

                {/* Température */}
                <VitalFieldLarge
                  icon="Thermo"
                  label={t('vitals.temp')}
                  unit="°C"
                  norm={t('vitals.tempRange')}
                  type="number"
                  step="0.1"
                  aria-label={t('vitals.temp')}
                  errorMessage={translateVitalsError(errors.tempC?.message, t)}
                  {...register('tempC', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
                />

                {/* SpO₂ */}
                <VitalFieldLarge
                  icon="Dot"
                  label={t('vitals.spo2')}
                  unit="%"
                  norm={t('vitals.spo2Range')}
                  type="number"
                  aria-label={t('vitals.spo2Aria')}
                  errorMessage={translateVitalsError(errors.spo2?.message, t)}
                  {...register('spo2', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
                />

                {/* Poids */}
                <VitalFieldLarge
                  icon="Dot"
                  label={t('vitals.weight')}
                  unit="kg"
                  norm={t('vitals.weightRange')}
                  type="number"
                  step="0.1"
                  aria-label={t('vitals.weight')}
                  errorMessage={translateVitalsError(errors.weightKg?.message, t)}
                  {...register('weightKg', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
                />

                {/* Taille */}
                <VitalFieldLarge
                  icon="Dot"
                  label={t('vitals.height')}
                  unit="cm"
                  norm={t('vitals.heightRange')}
                  type="number"
                  aria-label={t('vitals.height')}
                  errorMessage={translateVitalsError(errors.heightCm?.message, t)}
                  {...register('heightCm', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
                />
              </div>

              {/* BMI info bar */}
              <div className="pc-imc-bar">
                <Clock />
                {t('vitals.bmiCalc')}&nbsp;
                <strong style={{ color: 'var(--ink)' }}>{bmi}</strong>
                &nbsp;{t('vitals.bmiNote')}
              </div>
            </div>

            {/* Étape 2 · Mesures optionnelles */}
            <div className="pc-section">
              <div className="pc-step-h">{t('vitals.step2')}</div>
              <div className="pc-optional-grid">
                <Field>
                  <label htmlFor="pc-glycemia">{t('vitals.glycemia')}</label>
                  <Input
                    id="pc-glycemia"
                    type="number"
                    step="0.1"
                    placeholder="—"
                    {...register('glycemia', {
                      setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)),
                    })}
                  />
                </Field>
                <Field>
                  <label htmlFor="pc-abdominal">{t('vitals.abdo')}</label>
                  <Input
                    id="pc-abdominal"
                    type="number"
                    placeholder="—"
                    {...register('abdominalCm', {
                      setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)),
                    })}
                  />
                </Field>
                <Field>
                  <label htmlFor="pc-resp">{t('vitals.fr')}</label>
                  <Input
                    id="pc-resp"
                    type="number"
                    placeholder="—"
                    {...register('respRate', {
                      setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)),
                    })}
                  />
                </Field>
                <Field>
                  <label htmlFor="pc-headcirc">{t('vitals.headCirc')}</label>
                  <Input
                    id="pc-headcirc"
                    type="number"
                    step="0.1"
                    placeholder="—"
                    aria-label={t('vitals.headCircAria')}
                    {...register('headCircumferenceCm', {
                      setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)),
                    })}
                  />
                </Field>
              </div>
            </div>

            {/* Étape 3 · Motif & contexte */}
            <div className="pc-section">
              <div className="pc-step-h">{t('vitals.step3')}</div>
              <Field style={{ marginTop: 10 }}>
                <label htmlFor="pc-notes">{t('vitals.notes')}</label>
                <Textarea id="pc-notes" {...register('notes')} />
              </Field>
              <div className="pc-checks-row">
                <label className="pc-check-label">
                  <input type="checkbox" {...register('jeun')} /> {t('vitals.fasting')}
                </label>
                <label className="pc-check-label">
                  <input type="checkbox" {...register('carnet')} /> {t('vitals.booklet')}
                </label>
                <label className="pc-check-label">
                  <input type="checkbox" {...register('analyses')} /> {t('vitals.labResults')}
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right — reference panel ────────────────────────── */}
        <div className="pc-right scroll">
          <PreviousVitalsCard
            patient={patientCardData}
            showTaWarn={taWarn}
            submitting={isPending}
            onSaveAndWait={() => navigate('/salle')}
          />
        </div>

      </form>
    </Screen>
  );
}
