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
import { api } from '@/lib/api/client';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Check, Doc, Clipboard, Print } from '@/components/icons';
import { usePatient } from '@/features/dossier-patient/hooks/usePatient';
import { PrescriptionDrawer } from '@/features/prescription/PrescriptionDrawer';
import { usePrescriptions } from '@/features/prescription/hooks/usePrescriptions';
import { PrescriptionResultsPanel } from '@/features/prescription/components/PrescriptionResultsPanel';
import { ConsultationPrestationsPanel } from '@/features/prestation/components/ConsultationPrestationsPanel';
import type { PrescriptionType } from '@/features/prescription/types';
import { useInvoiceByConsultation } from '@/features/facturation/hooks/useInvoices';
import { useAdjustInvoiceTotal } from '@/features/facturation/hooks/useInvoiceMutations';
import { InvoiceDrawer } from '@/features/facturation/InvoiceDrawer';
import { FollowUpDialog } from './components/FollowUpDialog';
import { CertificatDialog } from './components/CertificatDialog';
import { PatientContextCard } from './components/PatientContextCard';
import { QuickVitalsDialog } from './components/QuickVitalsDialog';
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
  // Constantes scope = LA consultation en cours uniquement. Une visite
  // antérieure ne pollue pas la bannière courante : nouvelle consultation
  // = bilan neuf, dialog vide.
  const { vitals } = useLatestVitals(consultation?.patientId, consultation?.id);
  const { sign, isSigning, signed } = useSignConsultation(id);
  const { prescriptions } = usePrescriptions(id);
  const [postSignDialogOpen, setPostSignDialogOpen] = useState(false);
  const { invoice } = useInvoiceByConsultation(id, { pollUntilFound: postSignDialogOpen });
  const { adjustTotal, isPending: isAdjusting } = useAdjustInvoiceTotal();
  const [rxOpen, setRxOpen] = useState<PrescriptionType | null>(null);
  const [adjustingDiscount, setAdjustingDiscount] = useState<number | null>(null);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [certificatOpen, setCertificatOpen] = useState(false);

  const isSigned = consultation?.status === 'SIGNEE' || signed;
  // Le footer "Certificat" rouvre le PDF du dernier certificat généré pour
  // la consultation. Désactivé tant qu'aucun cert n'existe.
  const latestCert = [...prescriptions].reverse().find((p) => p.type === 'CERT');

  const {
    register,
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
      toast.success('Consultation signée. Détail de la facturation ouvert.');
      // Au lieu de rediriger immédiatement, ouvrir le détail facture pour que
      // le médecin puisse ajuster montants/remise avant que la secrétaire
      // n'émette. La modale poll le brouillon (créé en AFTER_COMMIT) jusqu'à
      // apparition. Demande Y. Boutaleb 2026-05-01.
      setPostSignDialogOpen(true);
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
    catalogue: '/catalogue',
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
  const patientLabel = patient
    ? `${patient.fullName} (${patient.age} ans · ${patient.sex})`
    : consultation
    ? 'Patient introuvable'
    : 'Chargement…';

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
      topbarRight={
        consultation && patient ? (
          <Button onClick={() => navigate(`/patients/${patient.id}`)}>
            Voir dossier patient
          </Button>
        ) : undefined
      }
      onNavigate={(navId) => navigate(navigateMap[navId])}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
        }}
        className="cs-layout"
      >
        <PatientContextCard
          patient={patient}
          vitals={vitals}
          canRecordVitals={!isSigned && !!consultation}
          onRecordVitals={() => setVitalsOpen(true)}
        />

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
              <Button type="button" onClick={() => navigate('/salle')}>
                Suspendre
              </Button>
              <Button
                type="button"
                disabled={!latestCert}
                onClick={() => {
                  if (!latestCert) return;
                  void api
                    .get(`/prescriptions/${latestCert.id}/pdf`, { responseType: 'blob' })
                    .then((r) => {
                      const url = URL.createObjectURL(r.data as Blob);
                      window.open(url, '_blank', 'noopener,noreferrer');
                    })
                    .catch(() => toast.error('Aperçu PDF impossible.'));
                }}
              >
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
              sub={`Ordonnance${prescriptions.length > 0 ? ` · ${prescriptions.length} créée${prescriptions.length > 1 ? 's' : ''}` : ''}`}
              disabled={isSigned || !consultation}
              onClick={() => setRxOpen('DRUG')}
            />
            <ActionBtn
              icon="Flask"
              label="Bon d'analyses"
              sub="Biologie médicale"
              disabled={isSigned || !consultation}
              onClick={() => setRxOpen('LAB')}
            />
            <ActionBtn
              icon="Scan"
              label="Bon d'imagerie"
              sub="Radio · écho · IRM"
              disabled={isSigned || !consultation}
              onClick={() => setRxOpen('IMAGING')}
            />
            <ActionBtn
              icon="Doc"
              label="Certificat médical"
              sub="Aptitude · présence · repos"
              disabled={!consultation || isSigned}
              onClick={() => setCertificatOpen(true)}
            />
            <ActionBtn
              icon="Calendar"
              label="Prochain RDV"
              sub="Contrôle / suivi"
              disabled={!consultation}
              onClick={() => setFollowUpOpen(true)}
            />
          </div>

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            Documents générés
          </div>
          <div className="cs-docs-list" style={{ fontSize: 12 }}>
            {prescriptions.length === 0 && (
              <div style={{ color: 'var(--ink-3)' }}>Aucun document généré.</div>
            )}
            {prescriptions.map((p) => (
              <div key={p.id}>
                <DocRow
                  title={`Ordonnance · ${p.lines.length} ligne${p.lines.length > 1 ? 's' : ''}`}
                  meta={
                    p.type === 'DRUG'
                      ? 'Médicaments'
                      : p.type === 'LAB'
                      ? 'Analyses'
                      : p.type === 'IMAGING'
                      ? 'Imagerie'
                      : (p.type ?? '—')
                  }
                  onClick={() => navigate(`/prescriptions/${p.id}`)}
                />
                {/* readOnly=false même quand la consultation est SIGNEE :
                    le patient ramène ses résultats d'analyses / d'imagerie
                    plusieurs jours après la consultation, le médecin doit
                    pouvoir les attacher à tout moment (rapport Y. Boutaleb
                    2026-05-01). Le verrou portait à tort sur la signature
                    SOAP, alors que le résultat est un évènement post-visite. */}
                <PrescriptionResultsPanel prescription={p} readOnly={false} />
              </div>
            ))}
          </div>

          {id && <ConsultationPrestationsPanel consultationId={id} readOnly={isSigned} />}

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            Facturation
          </div>
          <Panel className="cs-billing-panel">
            {!invoice && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)' }}>
                {isSigned
                  ? 'Facture brouillon en cours de création…'
                  : 'La facture brouillon sera générée à la signature.'}
              </div>
            )}
            {invoice && (
              <div style={{ padding: '10px 12px', fontSize: 12 }}>
                <div className="cs-billing-row">
                  <span style={{ color: 'var(--ink-3)' }}>Sous-total</span>
                  <span className="tnum">{invoice.totalAmount.toFixed(2).replace('.', ',')} MAD</span>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="cs-billing-row">
                    <span style={{ color: 'var(--ink-3)' }}>Remise</span>
                    <span className="tnum">- {invoice.discountAmount.toFixed(2).replace('.', ',')} MAD</span>
                  </div>
                )}
                <div className="cs-billing-total">
                  <span>Net à régler</span>
                  <span className="tnum">{invoice.netAmount.toFixed(2).replace('.', ',')} MAD</span>
                </div>
                {!isSigned && id && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Remise (MAD)"
                      value={adjustingDiscount ?? ''}
                      onChange={(e) =>
                        setAdjustingDiscount(e.target.value === '' ? null : Number(e.target.value))
                      }
                      style={{
                        flex: 1,
                        height: 28,
                        border: '1px solid var(--border)',
                        borderRadius: 4,
                        padding: '0 6px',
                        fontSize: 12,
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={isAdjusting || adjustingDiscount === null}
                      onClick={() => {
                        if (adjustingDiscount === null) return;
                        adjustTotal({
                          consultationId: id,
                          discountAmount: adjustingDiscount,
                        })
                          .then(() => {
                            toast.success('Total ajusté.');
                            setAdjustingDiscount(null);
                          })
                          .catch(() => toast.error('Ajustement refusé (rôle médecin requis).'));
                      }}
                    >
                      Ajuster
                    </Button>
                  </div>
                )}
                {isSigned && (
                  <Button
                    size="sm"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                    onClick={() => navigate('/facturation')}
                  >
                    Ouvrir la facture →
                  </Button>
                )}
              </div>
            )}
          </Panel>
        </div>
      </form>
      {consultation && (
        <QuickVitalsDialog
          open={vitalsOpen}
          onOpenChange={setVitalsOpen}
          consultationId={consultation.id}
          appointmentId={consultation.appointmentId}
          patientId={consultation.patientId}
          current={vitals}
        />
      )}
      {id && (
        <>
          <FollowUpDialog
            open={followUpOpen}
            onOpenChange={setFollowUpOpen}
            consultationId={id}
          />
          <CertificatDialog
            open={certificatOpen}
            onOpenChange={setCertificatOpen}
            consultationId={id}
          />
        </>
      )}
      <InvoiceDrawer
        invoice={invoice}
        open={postSignDialogOpen && !!invoice}
        onOpenChange={(o) => {
          if (!o) {
            setPostSignDialogOpen(false);
            void navigate('/facturation');
          }
        }}
      />
      {postSignDialogOpen && !invoice && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--r-md)',
              padding: 24,
              fontSize: 13,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            Génération du brouillon de facture en cours…
          </div>
        </div>
      )}
      {consultation && rxOpen && (
        <PrescriptionDrawer
          open={!!rxOpen}
          onOpenChange={(o) => {
            if (!o) setRxOpen(null);
          }}
          consultationId={consultation.id}
          patientAllergies={patient?.allergies ?? []}
          type={rxOpen}
          onCreated={() => {
            // Stay on the consultation so the doctor can chain prescriptions
            // (one consultation often issues a DRUG + a LAB + an IMAGING).
            // The new prescription appears immediately in "Documents générés"
            // because useCreatePrescription invalidates the consultation query.
            // The doctor opens / prints the bons from that list when ready.
            setRxOpen(null);
            toast.success('Ordonnance créée.');
          }}
        />
      )}
    </Screen>
  );
}
