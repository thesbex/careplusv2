/**
 * Screen 06 — Consultation (SOAP) mobile.
 * Fully wired version using RHF + autosave, mirroring the desktop flow but
 * with a vertically stacked form (no accordion — flat textareas for speed).
 */
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Warn, Lock } from '@/components/icons';
import { usePatient } from '@/features/dossier-patient/hooks/usePatient';
import { PrescriptionDrawer } from '@/features/prescription/PrescriptionDrawer';
import { useConsultation } from './hooks/useConsultation';
import { useSignConsultation } from './hooks/useSignConsultation';
import { useLatestVitals } from './hooks/useLatestVitals';
import { consultationDraftSchema, consultationSignSchema } from './schema';
import type { ConsultationFormValues } from './types';
import './consultation.css';

const AUTOSAVE_DEBOUNCE_MS = 2000;

function formFromApi(c: {
  motif: string | null;
  examination: string | null;
  diagnosis: string | null;
  notes: string | null;
}): ConsultationFormValues {
  return {
    subjectif: c.motif ?? '',
    objectif: c.examination ?? '',
    analyse: c.diagnosis ?? '',
    plan: c.notes ?? '',
  };
}

function apiFromForm(v: ConsultationFormValues) {
  return {
    motif: v.subjectif,
    examination: v.objectif,
    diagnosis: v.analyse,
    notes: v.plan,
  };
}

const SECTIONS: { key: keyof ConsultationFormValues; letter: string; title: string }[] = [
  { key: 'subjectif', letter: 'S', title: 'Subjectif' },
  { key: 'objectif', letter: 'O', title: 'Objectif' },
  { key: 'analyse', letter: 'A', title: 'Analyse' },
  { key: 'plan', letter: 'P', title: 'Plan' },
];

export default function ConsultationMobilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { consultation, isLoading, update, isSaving } = useConsultation(id);
  const { patient } = usePatient(consultation?.patientId);
  const { vitals } = useLatestVitals(consultation?.patientId);
  const { sign, isSigning, signed } = useSignConsultation(id);
  const [rxOpen, setRxOpen] = useState(false);

  const isSigned = consultation?.status === 'SIGNEE' || signed;

  const {
    register,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationDraftSchema),
    defaultValues: { subjectif: '', objectif: '', analyse: '', plan: '' },
  });

  const hydratedRef = useRef(false);
  useEffect(() => {
    if (consultation && !hydratedRef.current) {
      reset(formFromApi(consultation));
      hydratedRef.current = true;
    }
  }, [consultation, reset]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>('');
  useEffect(() => {
    if (!consultation || isSigned) return;
    const sub = watch((values) => {
      const serialized = JSON.stringify(values);
      if (serialized === lastSentRef.current) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastSentRef.current = serialized;
        update(apiFromForm(values as ConsultationFormValues)).catch(() => {
          toast.error('Autosave échoué');
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      sub.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [consultation, isSigned, watch, update]);

  async function handleSign() {
    const values = getValues();
    const parsed = consultationSignSchema.safeParse(values);
    if (!parsed.success) {
      toast.error('Tous les champs SOAP doivent être renseignés.');
      return;
    }
    try {
      await update(apiFromForm(values));
    } catch {
      toast.error('Sauvegarde échouée.');
      return;
    }
    const ok = await sign();
    if (ok) {
      toast.success('Consultation signée.');
      void navigate('/salle');
    }
  }

  const allergyLabel =
    patient && patient.allergies.length > 0 ? patient.allergies.join(', ') : null;

  const taLabel =
    vitals?.systolicMmhg != null && vitals.diastolicMmhg != null
      ? `${vitals.systolicMmhg}/${vitals.diastolicMmhg}`
      : '—';

  return (
    <MScreen
      tab="agenda"
      noTabs
      onTabChange={(t: MobileTab) => {
        const map: Record<MobileTab, string> = {
          agenda: '/agenda',
          salle: '/salle',
          patients: '/patients',
          factu: '/facturation',
          menu: '/parametres',
        };
        navigate(map[t]);
      }}
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate(-1)} />}
          title="Consultation"
          sub={patient ? patient.fullName : 'Chargement…'}
          right={<MIconBtn icon="MoreH" label="Plus d'actions" />}
        />
      }
    >
      {/* Patient context strip */}
      <div
        style={{
          background: 'var(--primary-soft)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {patient?.initials ?? '—'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{patient?.fullName ?? '—'}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {patient ? `${patient.sex} · ${patient.age} ans` : ''}
            {vitals?.systolicMmhg ? ` · TA ${taLabel}` : ''}
          </div>
        </div>
        {allergyLabel && (
          <span className="m-pill allergy">
            <Warn aria-hidden="true" /> {allergyLabel}
          </span>
        )}
      </div>

      <div className="mb-pad">
        {vitals && (
          <div className="cs-m-vitals-grid" role="region" aria-label="Constantes">
            <div className="cs-m-vital-cell">
              <div className="cs-m-vital-k">TA</div>
              <div className="cs-m-vital-v">{taLabel}</div>
            </div>
            <div className="cs-m-vital-cell">
              <div className="cs-m-vital-k">FC</div>
              <div className="cs-m-vital-v">{vitals.heartRateBpm ?? '—'}</div>
            </div>
            <div className="cs-m-vital-cell">
              <div className="cs-m-vital-k">T°</div>
              <div className="cs-m-vital-v">
                {vitals.temperatureC?.toFixed(1).replace('.', ',') ?? '—'}
              </div>
            </div>
            <div className="cs-m-vital-cell">
              <div className="cs-m-vital-k">SpO₂</div>
              <div className="cs-m-vital-v">{vitals.spo2Percent ?? '—'}</div>
            </div>
          </div>
        )}

        {isLoading && !consultation ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>
        ) : (
          <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SECTIONS.map((s) => (
              <div key={s.key} className="m-field">
                <label htmlFor={`m-soap-${s.key}`}>
                  <strong>{s.letter}</strong> · {s.title}
                </label>
                <textarea
                  id={`m-soap-${s.key}`}
                  className="m-input"
                  rows={4}
                  disabled={isSigned}
                  style={{ minHeight: 90, padding: 10, fontFamily: 'inherit' }}
                  aria-invalid={errors[s.key] ? true : undefined}
                  {...register(s.key)}
                />
              </div>
            ))}
          </form>
        )}

        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
          {isSigning
            ? 'Signature…'
            : isSigned
            ? 'Consultation signée.'
            : isSaving
            ? 'Enregistrement…'
            : 'Enregistré automatiquement.'}
        </div>

        <div className="cs-m-action-row">
          <button
            type="button"
            className="m-btn"
            style={{ height: 44 }}
            disabled={isSigned || !consultation}
            onClick={() => setRxOpen(true)}
          >
            Rx
          </button>
          <button
            type="button"
            className="m-btn primary"
            style={{ height: 44 }}
            disabled={isSigned || !consultation || isSigning}
            onClick={() => {
              void handleSign();
            }}
          >
            <Lock aria-hidden="true" /> {isSigned ? 'Signée' : 'Clôturer'}
          </button>
        </div>
      </div>
      {consultation && rxOpen && (
        <PrescriptionDrawer
          open={rxOpen}
          onOpenChange={setRxOpen}
          consultationId={consultation.id}
          patientAllergies={patient?.allergies ?? []}
          type="DRUG"
          onCreated={(prescriptionId) => {
            setRxOpen(false);
            void navigate(`/prescriptions/${prescriptionId}`);
          }}
        />
      )}
    </MScreen>
  );
}
