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
import { vitalsFormSchema, type VitalsFormValues } from './schema';
import { DEFAULT_VITALS } from './fixtures';
import './prise-constantes.css';

export default function PriseConstantesPage() {
  const navigate = useNavigate();
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const { submit, isPending } = useRecordVitals(appointmentId);
  const { appointment } = useAppointment(appointmentId);
  const { patient } = usePatient(appointment?.patientId);

  const aptTime = appointment
    ? new Date(appointment.startAt).toLocaleTimeString('fr-MA', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  const patientSub = patient
    ? `${patient.fullName} · ${patient.age} ans · RDV ${aptTime}`
    : 'Chargement…';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsFormSchema),
    defaultValues: {
      ...DEFAULT_VITALS,
      glycemia:    null,
      abdominalCm: null,
      respRate:    null,
    },
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
  const taWarn = (tensionSys ?? DEFAULT_VITALS.tensionSys) >= 130;

  const onSubmit = handleSubmit(async (values) => {
    await submit(values);
    navigate('/salle');
  });

  return (
    <Screen
      active="salle"
      title="Prise des constantes"
      sub={patientSub}
      onNavigate={(id) => {
        const map = {
          agenda:   '/agenda',
          patients: '/patients',
          salle:    '/salle',
          consult:  '/consultations',
          factu:    '/facturation',
          params:   '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <form onSubmit={onSubmit} noValidate className="pc-layout">

        {/* ── Left — form ─────────────────────────────────────── */}
        <div className="pc-left scroll">
          <div className="pc-left-inner">

            {/* Étape 1 · Mesures */}
            <div className="pc-section">
              <div className="pc-step-h">Étape 1 · Mesures</div>
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
                      Tension artérielle
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
                      aria-label="Tension systolique"
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
                      {...register('tensionSys', { valueAsNumber: true })}
                    />
                    <span style={{ fontSize: 16, color: 'var(--ink-3)', padding: '0 2px' }}>/</span>
                    <input
                      className="input tnum"
                      type="number"
                      aria-label="Tension diastolique"
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
                      {...register('tensionDia', { valueAsNumber: true })}
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
                    {errors.tensionSys?.message ??
                      errors.tensionDia?.message ??
                      'Plage acceptée : 20 – 300 / 10 – 250 mmHg'}
                  </div>
                </Panel>

                {/* Fréquence cardiaque */}
                <VitalFieldLarge
                  icon="Heart"
                  label="Fréquence cardiaque"
                  unit="bpm"
                  norm="Plage acceptée : 10 – 300"
                  type="number"
                  aria-label="Fréquence cardiaque"
                  errorMessage={errors.pulse?.message}
                  {...register('pulse', { valueAsNumber: true })}
                />

                {/* Température */}
                <VitalFieldLarge
                  icon="Thermo"
                  label="Température"
                  unit="°C"
                  norm="Plage acceptée : 20,0 – 46,0"
                  type="number"
                  step="0.1"
                  aria-label="Température"
                  errorMessage={errors.tempC?.message}
                  {...register('tempC', { valueAsNumber: true })}
                />

                {/* SpO₂ */}
                <VitalFieldLarge
                  icon="Dot"
                  label="SpO₂"
                  unit="%"
                  norm="Plage acceptée : 0 – 100"
                  type="number"
                  aria-label="Saturation O₂"
                  errorMessage={errors.spo2?.message}
                  {...register('spo2', { valueAsNumber: true })}
                />

                {/* Poids */}
                <VitalFieldLarge
                  icon="Dot"
                  label="Poids"
                  unit="kg"
                  norm="Plage acceptée : 0,2 – 500"
                  type="number"
                  step="0.1"
                  aria-label="Poids"
                  errorMessage={errors.weightKg?.message}
                  {...register('weightKg', { valueAsNumber: true })}
                />

                {/* Taille */}
                <VitalFieldLarge
                  icon="Dot"
                  label="Taille"
                  unit="cm"
                  norm="Plage acceptée : 20 – 260"
                  type="number"
                  aria-label="Taille"
                  errorMessage={errors.heightCm?.message}
                  {...register('heightCm', { valueAsNumber: true })}
                />
              </div>

              {/* BMI info bar */}
              <div className="pc-imc-bar">
                <Clock />
                IMC calculé :&nbsp;
                <strong style={{ color: 'var(--ink)' }}>{bmi}</strong>
                &nbsp;— Normal · Périmètre abdominal et glycémie capillaire en option ci-dessous.
              </div>
            </div>

            {/* Étape 2 · Mesures optionnelles */}
            <div className="pc-section">
              <div className="pc-step-h">Étape 2 · Mesures optionnelles</div>
              <div className="pc-optional-grid">
                <Field>
                  <label htmlFor="pc-glycemia">Glycémie capillaire (g/L)</label>
                  <Input
                    id="pc-glycemia"
                    type="number"
                    step="0.1"
                    placeholder="—"
                    {...register('glycemia', {
                      setValueAs: (v) => (v === '' ? null : Number(v)),
                    })}
                  />
                </Field>
                <Field>
                  <label htmlFor="pc-abdominal">Périmètre abdominal (cm)</label>
                  <Input
                    id="pc-abdominal"
                    type="number"
                    placeholder="—"
                    {...register('abdominalCm', {
                      setValueAs: (v) => (v === '' ? null : Number(v)),
                    })}
                  />
                </Field>
                <Field>
                  <label htmlFor="pc-resp">FR (/min)</label>
                  <Input
                    id="pc-resp"
                    type="number"
                    placeholder="—"
                    {...register('respRate', {
                      setValueAs: (v) => (v === '' ? null : Number(v)),
                    })}
                  />
                </Field>
              </div>
            </div>

            {/* Étape 3 · Motif & contexte */}
            <div className="pc-section">
              <div className="pc-step-h">Étape 3 · Motif &amp; contexte</div>
              <Field style={{ marginTop: 10 }}>
                <label htmlFor="pc-notes">Motif déclaré par le patient</label>
                <Textarea id="pc-notes" {...register('notes')} />
              </Field>
              <div className="pc-checks-row">
                <label className="pc-check-label">
                  <input type="checkbox" {...register('jeun')} /> À jeun
                </label>
                <label className="pc-check-label">
                  <input type="checkbox" {...register('carnet')} /> Carnet de santé apporté
                </label>
                <label className="pc-check-label">
                  <input type="checkbox" {...register('analyses')} /> Résultats d'analyses apportés
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* ── Right — reference panel ────────────────────────── */}
        <div className="pc-right scroll">
          <PreviousVitalsCard
            showTaWarn={taWarn}
            submitting={isPending}
            onSaveAndWait={() => navigate('/salle')}
          />
        </div>

      </form>
    </Screen>
  );
}
