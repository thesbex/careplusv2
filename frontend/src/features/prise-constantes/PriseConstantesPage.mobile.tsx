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
import { useT } from '@/lib/i18n/I18nProvider';
import { vitalsFormSchema, translateVitalsError, type VitalsFormValues } from './schema';
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
  headCircumferenceCm: null,
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
  const { t } = useT();
  const { appointmentId } = useParams<{ appointmentId?: string }>();
  const { submit, isPending } = useRecordVitals(appointmentId);
  const { appointment, isLoading: aptLoading, error: aptError } = useAppointment(appointmentId);
  const { patient, isLoading: patLoading, error: patError } = usePatient(appointment?.patientId);
  const patientName = patient?.fullName ?? t('common.loading');
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
      try {
        await submit(values);
        navigate('/salle');
      } catch (err) {
        // Same silent-failure fix as the desktop variant (2026-05-02).
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
              <MIconBtn icon="ChevronLeft" label={t('consult.list.back')} onClick={() => navigate('/salle')} />
            }
            title={t('vitals.mobile.title')}
            sub={t('vitals.mobile.errorSub')}
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
              <MIconBtn icon="ChevronLeft" label={t('consult.list.back')} onClick={() => navigate('/salle')} />
            }
            title={t('vitals.mobile.title')}
            sub={t('common.loading')}
          />
        }
      >
        <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>{t('vitals.loadingPatient')}</div>
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
              label={t('consult.list.back')}
              onClick={() => navigate('/salle')}
            />
          }
          title={t('vitals.mobile.title')}
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
              <span>{t('vitals.mobile.allergy', { list: allergyLabel })}</span>
            </div>
          )}

          {/* Section heading */}
          <div className="m-section-h">
            <h3>{t('vitals.mobile.vitalSigns')}</h3>
          </div>

          {/* Tension artérielle — composite (SYS / DIA) */}
          <div className="m-card" style={{ marginBottom: 10 }}>
            <div className="pc-m-card-header">
              <span style={{ color: 'var(--primary)' }}><Heart /></span>
              <span className="pc-m-card-label">{t('vitals.ta')}</span>
              <span className="pc-m-card-ref">{t('vitals.mobile.taRef')}</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label={t('vitals.taSys')}
                style={largeInputStyle}
                {...register('tensionSys', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <span className="pc-m-input-unit">/</span>
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label={t('vitals.taDia')}
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
              <span className="pc-m-card-label">{t('vitals.fc')}</span>
              <span className="pc-m-card-ref">{t('vitals.mobile.fcRef')}</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label={t('vitals.fc')}
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
              <span className="pc-m-card-label">{t('vitals.temp')}</span>
              <span className="pc-m-card-ref">{t('vitals.mobile.tempRef')}</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                step="0.1"
                placeholder="—"
                aria-label={t('vitals.temp')}
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
              <span className="pc-m-card-label">{t('vitals.mobile.spo2')}</span>
              <span className="pc-m-card-ref">{t('vitals.mobile.spo2Ref')}</span>
            </div>
            <div className="pc-m-input-row">
              <input
                className="m-input"
                type="number"
                placeholder="—"
                aria-label={t('vitals.spo2Aria')}
                style={largeInputStyle}
                {...register('spo2', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <span className="pc-m-input-unit">%</span>
            </div>
          </div>

          {/* Poids · Taille · IMC row */}
          <div className="m-field" style={{ marginTop: 12 }}>
            <label>{t('vitals.mobile.weightHeightBmi')}</label>
            <div className="pc-m-wht-grid">
              <input
                className="m-input"
                type="number"
                step="0.1"
                placeholder={t('vitals.mobile.weightPlaceholder')}
                aria-label={t('vitals.mobile.weightAria')}
                {...register('weightKg', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <input
                className="m-input"
                type="number"
                placeholder={t('vitals.mobile.heightPlaceholder')}
                aria-label={t('vitals.mobile.heightAria')}
                {...register('heightCm', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <input
                className="m-input"
                placeholder={t('vitals.mobile.bmiPlaceholder')}
                aria-label={t('vitals.mobile.bmiAria')}
                disabled
                value={bmi}
                onChange={() => undefined}
                style={{ background: 'var(--bg-alt)' }}
              />
            </div>
          </div>

          {/*
            Mesures optionnelles (FR / glycémie / périmètres) — même contrat
            DTO que le desktop (B1 fix 2026-05-06). Sans ces champs côté
            mobile, un médecin saisissait ex. un périmètre crânien sur
            tablette → champ absent → valeur jamais envoyée.
          */}
          <div className="m-field" style={{ marginTop: 12 }}>
            <label>{t('vitals.mobile.optionalRow')}</label>
            <div className="pc-m-wht-grid">
              <input
                className="m-input"
                type="number"
                placeholder={t('vitals.mobile.frPlaceholder')}
                aria-label={t('vitals.mobile.frAria')}
                {...register('respRate', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <input
                className="m-input"
                type="number"
                step="0.1"
                placeholder={t('vitals.mobile.glycemiaPlaceholder')}
                aria-label={t('vitals.mobile.glycemiaAria')}
                {...register('glycemia', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
              <input
                className="m-input"
                type="number"
                placeholder={t('vitals.mobile.abdoPlaceholder')}
                aria-label={t('vitals.mobile.abdoAria')}
                {...register('abdominalCm', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
              />
            </div>
          </div>

          <div className="m-field" style={{ marginTop: 12 }}>
            <label htmlFor="m-pc-head">{t('vitals.headCirc')}</label>
            <input
              id="m-pc-head"
              className="m-input"
              type="number"
              step="0.1"
              placeholder={t('vitals.mobile.headPlaceholder')}
              aria-label={t('vitals.mobile.headAria')}
              {...register('headCircumferenceCm', { setValueAs: (v: unknown) => (v === '' || v == null || Number.isNaN(v) ? null : Number(v)) })}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="m-btn primary"
            style={{ marginTop: 16 }}
            disabled={isPending}
          >
            {isPending ? t('common.saving') : t('vitals.mobile.save')}
          </button>

        </div>
      </form>
    </MScreen>
  );
}
