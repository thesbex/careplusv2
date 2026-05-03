/**
 * Screen 06 — Consultation (SOAP) desktop.
 * Fully wired to the backend consultation module (J5).
 *
 * Flow:
 *   GET /consultations/:id       — hydrate form
 *   GET /patients/:patientId     — patient context
 *   GET /patients/:patientId/vitals — latest vitals
 *   PUT /consultations/:id       — autosave every 2 s after last change
 *   POST /consultations/:id/sign — on "Clôturer et facturer"
 */
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Check, Doc, Clipboard, Print } from '@/components/icons';
import { usePatient } from '@/features/dossier-patient/hooks/usePatient';
import { PatientContextCard } from './components/PatientContextCard';
import { SoapEditor, ActionBtn, DocRow } from './components/SoapEditor';
import { SignatureLock } from './components/SignatureLock';
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

export default function ConsultationPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { consultation, isLoading, error, update, isSaving, lastSavedAt } = useConsultation(id);
  const { patient } = usePatient(consultation?.patientId);
  const { vitals } = useLatestVitals(consultation?.patientId);
  const { sign, isSigning, signed } = useSignConsultation(id);

  const isSigned = consultation?.status === 'SIGNEE' || signed;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
    trigger,
    getValues,
  } = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationDraftSchema),
    defaultValues: { subjectif: '', objectif: '', analyse: '', plan: '' },
  });

  // Hydrate form once the consultation is loaded.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (consultation && !hydratedRef.current) {
      reset(formFromApi(consultation));
      hydratedRef.current = true;
    }
  }, [consultation, reset]);

  // Debounced autosave. Subscribes to watch() and fires PUT 2s after last change.
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
        update(apiFromForm(values as ConsultationFormValues)).catch((err: unknown) => {
          toast.error('Autosave échoué', {
            description: err instanceof Error ? err.message : undefined,
          });
        });
      }, AUTOSAVE_DEBOUNCE_MS);
    });
    return () => {
      sub.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [consultation, isSigned, watch, update]);

  // Flush pending autosave right before signing.
  async function handleSignConfirm(): Promise<boolean> {
    const values = getValues();
    const parsed = consultationSignSchema.safeParse(values);
    if (!parsed.success) {
      const firstErr = parsed.error.issues[0];
      toast.error('Impossible de signer', {
        description: firstErr?.message ?? 'Tous les champs SOAP doivent être renseignés.',
      });
      await trigger();
      return false;
    }
    // Ensure latest content is persisted before sign.
    try {
      await update(apiFromForm(values));
    } catch {
      toast.error('Sauvegarde pré-signature échouée');
      return false;
    }
    const ok = await sign();
    if (ok) {
      toast.success('Consultation signée. Facture brouillon générée.');
      void navigate('/facturation');
    } else {
      toast.error('Signature refusée par le serveur.');
    }
    return ok;
  }

  const [navigateMap] = useState({
    agenda: '/agenda',
    patients: '/patients',
    salle: '/salle',
    consult: '/consultations',
    factu: '/facturation',
    params: '/parametres',
  } as const);

  const startedLabel = consultation
    ? new Date(consultation.startedAt).toLocaleTimeString('fr-MA', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  const savedLabel = lastSavedAt
    ? lastSavedAt.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const patientLabel = patient ? patient.fullName : 'Chargement…';

  if (error) {
    return (
      <Screen
        active="consult"
        title="Consultation"
        sub="Erreur"
        onNavigate={(navId) => navigate(navigateMap[navId])}
      >
        <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      </Screen>
    );
  }

  return (
    <Screen
      active="consult"
      title="Consultation en cours"
      sub={`${patientLabel}${consultation ? ` · Débutée à ${startedLabel}` : ''}`}
      onNavigate={(navId) => navigate(navigateMap[navId])}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="cs-layout"
      >
        <PatientContextCard patient={patient} vitals={vitals} />

        <div className="cs-soap-col">
          <div className="cs-soap-toolbar">
            <Pill status={isSigned ? 'done' : 'consult'} dot>
              {isSigned ? 'Signée' : 'En consultation'}
            </Pill>
            <span className="tnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Démarrée {startedLabel}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button size="sm" type="button" disabled>
                <Doc /> Modèles
              </Button>
              <Button size="sm" type="button" disabled>
                <Clipboard /> CIM-10
              </Button>
            </div>
          </div>

          <div className="cs-soap-body scroll">
            {isLoading && !consultation ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement de la consultation…</div>
            ) : (
              <SoapEditor register={register} errors={errors} disabled={isSigned} />
            )}
          </div>

          <div className="cs-soap-footer">
            <span className="cs-autosave">
              <Check aria-hidden="true" />{' '}
              {isSaving
                ? 'Enregistrement…'
                : isSigned
                ? `Signée le ${savedLabel}`
                : `Enregistré automatiquement · ${savedLabel}`}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button type="button" onClick={() => handleSubmit(() => undefined)()}>
                Suspendre
              </Button>
              <Button type="button" disabled>
                <Print /> Certificat
              </Button>
              <SignatureLock
                onConfirm={handleSignConfirm}
                isSigning={isSigning}
                signed={isSigned}
                disabled={!consultation}
              />
            </div>
          </div>
        </div>

        <div className="cs-actions-col scroll">
          <div className="cs-section-h">Actions</div>

          <div className="cs-actions-list">
            <ActionBtn
              icon="Pill"
              color="primary"
              label="Prescription médicaments"
              sub={isSigned ? 'Consultation signée' : 'Ordonnance'}
              disabled={isSigned || !consultation}
              onClick={() =>
                toast.info('Prescription', {
                  description: 'Drawer prescription — à porter en Étape 2.',
                })
              }
            />
            <ActionBtn
              icon="Flask"
              label="Bon d'analyses"
              sub="Biologie médicale"
              disabled={isSigned || !consultation}
              onClick={() =>
                toast.info('Bon analyses', { description: 'À porter en Étape 2.' })
              }
            />
            <ActionBtn
              icon="Scan"
              label="Bon d'imagerie"
              sub="Radio · écho · IRM"
              disabled={isSigned || !consultation}
              onClick={() =>
                toast.info('Bon imagerie', { description: 'À porter en Étape 2.' })
              }
            />
            <ActionBtn icon="Doc" label="Certificat médical" disabled />
            <ActionBtn icon="Calendar" label="Prochain RDV" disabled />
          </div>

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            Documents générés
          </div>
          <div className="cs-docs-list" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            {isSigned ? (
              <DocRow title="Consultation signée" meta="Document verrouillé" />
            ) : (
              <div>Aucun document généré.</div>
            )}
          </div>

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            Facturation
          </div>
          <Panel className="cs-billing-panel">
            <div
              style={{
                padding: '10px 12px',
                fontSize: 12,
                color: 'var(--ink-3)',
              }}
            >
              {isSigned
                ? 'Facture brouillon créée — voir Facturation.'
                : 'La facture brouillon sera générée à la signature.'}
            </div>
          </Panel>
        </div>
      </form>
    </Screen>
  );
}
