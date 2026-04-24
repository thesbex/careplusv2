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
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { Heart, Thermo, Signal, Warn } from '@/components/icons';
import { useRecordVitals } from './hooks/useRecordVitals';
import { vitalsFormSchema, type VitalsFormValues } from './schema';
import { DEFAULT_VITALS } from './fixtures';
import './prise-constantes.css';

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

  const {
    register,
    handleSubmit,
    watch,
  } = useForm<VitalsFormValues>({
    resolver: zodResolver(vitalsFormSchema),
    defaultValues: {
      ...DEFAULT_VITALS,
      glycemia:    null,
      abdominalCm: null,
      respRate:    null,
    },
  });

  const weightKg = watch('weightKg');
  const heightCm = watch('heightCm');

  /** BMI computed live, displayed in the disabled IMC field. */
  const bmi =
    weightKg && heightCm && heightCm > 0
      ? (weightKg / Math.pow(heightCm / 100, 2)).toFixed(1)
      : '';

  const onSubmit = handleSubmit(async (values) => {
    await submit(values);
    navigate('/salle');
  });

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
          sub="Mohamed Alami"
        />
      }
    >
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-pad-lg">

          {/* Allergy warning bar — verbatim from prototype */}
          <div className="pc-m-allergy-bar">
            <Warn />
            <span>Allergie : Pénicilline</span>
          </div>

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
                {...register('tensionSys', { valueAsNumber: true })}
              />
              <span className="pc-m-input-unit">/</span>
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label="Tension diastolique"
                style={largeInputStyle}
                {...register('tensionDia', { valueAsNumber: true })}
              />
              <span className="pc-m-input-unit">mmHg</span>
            </div>
            <div className="pc-m-prev">Prec. 135/85</div>
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
                {...register('pulse', { valueAsNumber: true })}
              />
              <span className="pc-m-input-unit">bpm</span>
            </div>
            <div className="pc-m-prev">Prec. 78</div>
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
                {...register('tempC', { valueAsNumber: true })}
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
                {...register('spo2', { valueAsNumber: true })}
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
                {...register('weightKg', { valueAsNumber: true })}
              />
              <input
                className="m-input"
                type="number"
                placeholder="Taille"
                aria-label="Taille (cm)"
                {...register('heightCm', { valueAsNumber: true })}
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
