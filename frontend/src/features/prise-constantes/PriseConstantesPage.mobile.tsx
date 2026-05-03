/**
 * M05 — Prise des constantes (mobile).
 * Ported from design/prototype/mobile/screens.jsx:MConstantes verbatim.
 *
 * Shell: <MScreen tab="salle" noTabs> — no bottom tabs on this flow screen.
 * Topbar: back arrow + title "Constantes" + sub "Mohamed Alami" (prototype name).
 *
 * Backend dependency: J5 vitals module — currently uses fixture defaults
 * and a mock submission via useRecordVitals.
 * TODO(backend:J5): swap useRecordVitals to real mutation POST
 *   /api/appointments/:appointmentId/vitals
 */
import type { CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Heart, Thermo, Signal, Warn } from '@/components/icons';
import { useRecordVitals } from './hooks/useRecordVitals';
import { useAppointment } from './hooks/useAppointment';
import { usePatient } from '@/features/dossier-patient/hooks/usePatient';
import { vitalsFormSchema, type VitalsFormValues } from './schema';
import './prise-constantes.css';

/** Empty form values — same rationale as the desktop variant: never pre-fill. */
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
  notes: '',
  jeun: false,
  carnet: false,
  analyses: false,
};

/** Large-input style shared across all vital input fields. */
const largeInputStyle: CSSProperties = {
  flex: 1,
  height: 54,
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  fontVariantNumeric: 'tabular-nums',
};

export default function PriseConstantesMobilePage() {
  const navigate = useNavigate();
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const { submit, isPending } = useRecordVitals(appointmentId);
  const { appointment, isLoading: aptLoading, error: aptError } = useAppointment(appointmentId);
  const { patient, isLoading: patLoading, error: patError } = usePatient(appointment?.patientId);
  const patientName = patient?.fullName ?? 'Chargement…';
  const allergyLabel =
    patient && patient.allergies.length > 0 ? patient.allergies.join(', ') : null;

  const {
    register,
    handleSubmit,
    watch,
  } = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsFormSchema),
    defaultValues: EMPTY_VITALS,
  });

  const weightKg = watch('weightKg');
  const heightCm = watch('heightCm');

  /** BMI computed live, displayed in the disabled IMC field. */
  const bmi =
    weightKg && heightCm && heightCm > 0
      ? (weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)
      : '';

  const onSubmit = handleSubmit(
    async (values) => {
      await submit(values);
      navigate('/salle');
    },
    (errs) => {
      const first = Object.values(errs)[0] as { message?: string } | undefined;
      const root = (errs as { root?: { message?: string } }).root;
      toast.error('Impossible d\'enregistrer', {
        description: root?.message ?? first?.message ?? 'Vérifiez les valeurs saisies.',
      });
    },
  );

  // Same hard gate as desktop — never let the form render with stale / fixture
  // patient data. See audit 2026-05-01.
  if (aptError || patError) {
    return (
      <MScreen
        tab="salle"
        noTabs
        topbar={
          <MTopbar
            left={
              <MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/salle')} />
            }
            title="Constantes"
            sub="Erreur de chargement"
          />
        }
      >
        <div role="alert" style={{ padding: 16, color: 'var(--danger)', fontSize: 14 }}>
          {aptError ?? patError}
        </div>
      </MScreen>
    );
  }
  if (aptLoading || patLoading || !appointment || !patient) {
    return (
      <MScreen
        tab="salle"
        noTabs
        topbar={
          <MTopbar
            left={
              <MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/salle')} />
            }
            title="Constantes"
            sub="Chargement…"
          />
        }
      >
        <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>Chargement du patient…</div>
      </MScreen>
    );
  }

  return (
    <MScreen
      tab="salle"
      noTabs
      topbar={
        <MTopbar
          left={
            <MIconBtn
              icon="ChevronLeft"
              label="Retour"
              onClick={() => navigate('/salle')}
            />
          }
          title="Constantes"
          sub={patientName}
        />
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-pad-lg">

          {/* Allergy warning bar — shown only if patient has allergies */}
          {allergyLabel && (
            <div className="pc-m-allergy-bar">
              <Warn />
              <span>Allergie : {allergyLabel}</span>
            </div>
          )}

          {/* Section heading */}
          <div className="m-section-h">
            <h3>Signes vitaux</h3>
          </div>

          {/* Tension artérielle — composite (SYS / DIA) */}
          <div className="m-card" style={{ marginBottom: 10 }}>
            <div className="pc-m-card-header">
              <span style={{ color: 'var(--primary)' }}><Heart /></span>
              <span className="pc-m-card-label">Tension artérielle</span>
              <span className="pc-m-card-ref">Ref. 120/80</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label="Tension systolique"
                style={largeInputStyle}
                {...register('tensionSys', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <span className="pc-m-input-unit">/</span>
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label="Tension diastolique"
                style={largeInputStyle}
                {...register('tensionDia', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <span className="pc-m-input-unit">mmHg</span>
            </div>
          </div>

          {/* Fréquence cardiaque */}
          <div className="m-card" style={{ marginBottom: 10 }}>
            <div className="pc-m-card-header">
              <span style={{ color: 'var(--primary)' }}><Heart /></span>
              <span className="pc-m-card-label">Fréquence cardiaque</span>
              <span className="pc-m-card-ref">Ref. 60–100</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label="Fréquence cardiaque"
                style={largeInputStyle}
                {...register('pulse', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <span className="pc-m-input-unit">bpm</span>
            </div>
          </div>

          {/* Température */}
          <div className="m-card" style={{ marginBottom: 10 }}>
            <div className="pc-m-card-header">
              <span style={{ color: 'var(--primary)' }}><Thermo /></span>
              <span className="pc-m-card-label">Température</span>
              <span className="pc-m-card-ref">Ref. 36,1–37,2</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                step="0.1"
                placeholder="—"
                aria-label="Température"
                style={largeInputStyle}
                {...register('tempC', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <span className="pc-m-input-unit">°C</span>
            </div>
          </div>

          {/* Saturation O₂ */}
          <div className="m-card" style={{ marginBottom: 10 }}>
            <div className="pc-m-card-header">
              <span style={{ color: 'var(--primary)' }}><Signal /></span>
              <span className="pc-m-card-label">Saturation O₂</span>
              <span className="pc-m-card-ref">Ref. ≥ 95</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label="Saturation O₂"
                style={largeInputStyle}
                {...register('spo2', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <span className="pc-m-input-unit">%</span>
            </div>
          </div>

          {/* Poids · Taille · IMC row */}
          <div className="m-field" style={{ marginTop: 12 }}>
            <label>Poids · Taille · IMC</label>
            <div className="pc-m-wht-grid">
              <input
                className="m-input"
                type="number"
                step="0.1"
                placeholder="Poids"
                aria-label="Poids (kg)"
                {...register('weightKg', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <input
                className="m-input"
                type="number"
                placeholder="Taille"
                aria-label="Taille (cm)"
                {...register('heightCm', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <input
                className="m-input"
                placeholder="IMC"
                aria-label="IMC calculé"
                disabled
                value={bmi}
                onChange={() => undefined}
                style={{ background: 'var(--bg-alt)' }}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="m-btn primary"
            style={{ marginTop: 16 }}
            disabled={isPending}
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer et passer la main'}
          </button>

        </div>
      </form>
    </MScreen>
  );
}
