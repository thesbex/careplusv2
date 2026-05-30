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
import { Check } from '@/components/icons';
import { usePatient } from '@/features/dossier-patient/hooks/usePatient';
import { usePatientStays } from '@/features/hospitalisation/hooks/useStays';
import { useClinicSettings } from '@/features/parametres/hooks/useSettings';
import { PrescriptionDrawer } from '@/features/prescription/PrescriptionDrawer';
import { usePrescriptions } from '@/features/prescription/hooks/usePrescriptions';
import { useDeletePrescription } from '@/features/prescription/hooks/useDeletePrescription';
import { PrescriptionResultsPanel } from '@/features/prescription/components/PrescriptionResultsPanel';
import { metaForPrescription } from '@/features/prescription/components/DocumentPdfViewer';
import { ConsultationPrestationsPanel } from '@/features/prestation/components/ConsultationPrestationsPanel';
import type { PrescriptionType } from '@/features/prescription/types';
import { useInvoiceByConsultation } from '@/features/facturation/hooks/useInvoices';
import { useAdjustInvoiceTotal } from '@/features/facturation/hooks/useInvoiceMutations';
import { InvoiceDrawer } from '@/features/facturation/InvoiceDrawer';
import { FollowUpDialog } from './components/FollowUpDialog';
import { CertificatDialog } from './components/CertificatDialog';
import { ConfrereLetterDialog } from '@/features/confrere/components/ConfrereLetterDialog';
import { ConsentDialog } from '@/features/consent/components/ConsentDialog';
import { ConsentUploadDialog } from '@/features/consent/components/ConsentUploadDialog';
import { useConfrereLetters } from '@/features/confrere/hooks/useConfrereLetters';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import { PatientContextCard } from './components/PatientContextCard';
import { QuickVitalsDialog } from './components/QuickVitalsDialog';
import { SoapEditor, ActionBtn, DocRow } from './components/SoapEditor';
import { SoapToolbarButtons } from './components/SoapToolbarButtons';
import { PromoteDiagnosisDialog } from './components/PromoteDiagnosisDialog';
import { SuspendChoiceDialog } from './components/SuspendChoiceDialog';
import { SignatureLock } from './components/SignatureLock';
import { useCancelAppointment } from '@/features/salle-attente/hooks/useCancelAppointment';
import { useConsultation } from './hooks/useConsultation';
import { useSignConsultation } from './hooks/useSignConsultation';
import { useSuspendConsultation } from './hooks/useSuspendConsultation';
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
  const { t: tr } = useT();
  const { id } = useParams<{ id?: string }>();
  const { consultation, isLoading, error, update, isSaving, lastSavedAt } = useConsultation(id);
  const { patient } = usePatient(consultation?.patientId);
  // C5 — si le patient est hospitalisé (séjour EN_COURS), la facture brouillon de
  // cette consultation sera englobée dans la facture de séjour à la sortie
  // (StayService.absorbConsultationDrafts) plutôt que réglée tout de suite. On le
  // signale à l'utilisateur. Requête gated sur la capability hospitalisation.
  const { settings: clinicSettings } = useClinicSettings();
  const hospEnabled = clinicSettings?.hospitalizationEnabled ?? false;
  const { stays: patientStays } = usePatientStays(
    hospEnabled ? (consultation?.patientId ?? null) : null,
  );
  const activeStay = patientStays.find((s) => s.status === 'EN_COURS');
  // Constantes scope = LA consultation en cours uniquement. Une visite
  // antérieure ne pollue pas la bannière courante : nouvelle consultation
  // = bilan neuf, dialog vide.
  const { vitals } = useLatestVitals(consultation?.patientId, consultation?.id);
  const { sign, isSigning, signed } = useSignConsultation(id);
  const { suspend, isSuspending } = useSuspendConsultation(id);
  const { prescriptions } = usePrescriptions(id);
  const { letters: confrereLetters } = useConfrereLetters(id);
  const { remove: removePrescription } = useDeletePrescription(id, consultation?.patientId);

  // Télécharge un courrier confrère (document patient) via le JWT en mémoire,
  // sans pop-up bloqué (cf. ADR-038) : <a download> cliqué par programme.
  async function downloadConfrereLetter(documentId: string, recipient?: string) {
    try {
      const res = await api.get<Blob>(`/documents/${documentId}/content`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = (recipient ?? 'courrier').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
      a.download = `courrier-confrere-${slug || 'document'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      toast.error(tr('consult.letterDownloadFailed'));
    }
  }
  const [postSignDialogOpen, setPostSignDialogOpen] = useState(false);
  const { invoice } = useInvoiceByConsultation(id, { pollUntilFound: postSignDialogOpen });
  const { adjustTotal, isPending: isAdjusting } = useAdjustInvoiceTotal();
  const [rxOpen, setRxOpen] = useState<PrescriptionType | null>(null);
  const [adjustingDiscount, setAdjustingDiscount] = useState<number | null>(null);
  const [vitalsOpen, setVitalsOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [certificatOpen, setCertificatOpen] = useState(false);
  const [confrereOpen, setConfrereOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentUploadOpen, setConsentUploadOpen] = useState(false);

  const isSigned = consultation?.status === 'SIGNEE' || signed;
  const isSuspended = consultation?.status === 'SUSPENDUE' && !isSigned;
  // (latestCert retiré — utilisé seulement par l'ancien bouton "Certificat" du
  // footer, doublon des CTAs en haut. Cf. retour terrain.)

  const {
    register,
    reset,
    watch,
    formState: { errors },
    trigger,
    getValues,
    setValue,
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

  // Dialog "Ajouter aux antécédents".
  const [promoteOpen, setPromoteOpen] = useState(false);

  // Dialog "Suspendre la consultation" — choix entre "remettre en salle"
  // et "annuler le rendez-vous" (avec raison).
  const [suspendOpen, setSuspendOpen] = useState(false);
  const { cancel: cancelAppointment } = useCancelAppointment();

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
          toast.error(tr('consult.autosaveFailed'), {
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
      toast.error(tr('consult.sign.errorTitle'), {
        description: firstErr?.message ? tr(firstErr.message) : tr('consult.sign.allRequired'),
      });
      await trigger();
      return false;
    }
    // Ensure latest content is persisted before sign.
    try {
      await update(apiFromForm(values));
    } catch {
      toast.error(tr('consult.preSignSaveFailed'));
      return false;
    }
    const ok = await sign();
    if (ok) {
      toast.success(tr('consult.signedOpenBilling'));
      // Au lieu de rediriger immédiatement, ouvrir le détail facture pour que
      // le médecin puisse ajuster montants/remise avant que la secrétaire
      // n'émette. La modale poll le brouillon (créé en AFTER_COMMIT) jusqu'à
      // apparition. Demande Y. Boutaleb 2026-05-01.
      setPostSignDialogOpen(true);
    } else {
      toast.error(tr('consult.signRefused'));
    }
    return ok;
  }

  const [navigateMap] = useState({
    dashboard: '/dashboard',
    agenda: '/agenda',
    patients: '/patients',
    salle: '/salle',
    consult: '/consultations',
    factu: '/facturation',
    vaccinations: '/vaccinations',
    grossesses: '/grossesses',
    stock: '/stock',
    queueLab: '/queue/lab',
    queueRadio: '/queue/radio',
    messages: '/messages',
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
    ? `${patient.fullName} (${tr('consult.ctx.yearsOld', { n: patient.age })} · ${patient.sex})`
    : consultation
    ? tr('consult.patientNotFound')
    : tr('common.loading');

  if (error) {
    return (
      <Screen
        active="consult"
        title={tr('consult.title')}
        sub={tr('consult.errorSub')}
        onNavigate={(navId) => navigate(navigateMap[navId])}
      >
        <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
      </Screen>
    );
  }

  return (
    <Screen
      active="consult"
      title={tr('consult.titleInProgress')}
      sub={`${patientLabel}${consultation ? ` · ${tr('consult.startedAtSub', { time: startedLabel })}` : ''}`}
      topbarRight={
        consultation && patient ? (
          <Button onClick={() => navigate(`/patients/${patient.id}`)}>
            {tr('consult.openDossier')}
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
            <Pill status={isSigned ? 'done' : isSuspended ? 'arrived' : 'consult'} dot>
              {isSigned ? tr('consult.status.signed') : isSuspended ? tr('consult.status.suspended') : tr('consult.status.inConsult')}
            </Pill>
            <span className="tnum" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {tr('consult.startedAt', { time: startedLabel })}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <SoapToolbarButtons
                disabled={isSigned}
                onApplyTemplate={(tpl) => {
                  setValue('subjectif', tpl.subjectif ?? '', { shouldDirty: true });
                  setValue('objectif', tpl.objectif ?? '', { shouldDirty: true });
                  setValue('analyse', tpl.analyse ?? '', { shouldDirty: true });
                  setValue('plan', tpl.plan ?? '', { shouldDirty: true });
                  toast.success(tr('consult.toolbar.templateApplied', { name: tpl.name }));
                }}
                onInsertCim={(text) => {
                  const cur = getValues('analyse') ?? '';
                  setValue('analyse', cur.trim() ? `${cur}\n${text}` : text, { shouldDirty: true });
                  toast.success(tr('consult.toolbar.cimAdded'));
                }}
              />
            </div>
          </div>

          <div className="cs-soap-body scroll">
            {isLoading && !consultation ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{tr('consult.loadingConsultation')}</div>
            ) : (
              <SoapEditor
                register={register}
                errors={errors}
                disabled={isSigned}
                afterAnalyse={
                  consultation?.patientId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!watch('analyse')?.trim()}
                      onClick={() => setPromoteOpen(true)}
                    >
                      {tr('consult.addToHistory')}
                    </Button>
                  ) : null
                }
              />
            )}
          </div>

          <div className="cs-soap-footer">
            <span className="cs-autosave">
              <Check aria-hidden="true" />{' '}
              {isSaving
                ? tr('consult.saving')
                : isSigned
                ? tr('consult.signedOn', { time: savedLabel })
                : tr('consult.autosavedAt', { time: savedLabel })}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Button
                type="button"
                disabled={isSuspending || isSigned}
                onClick={async () => {
                  // Flush any pending autosave so we don't lose in-flight edits.
                  if (timerRef.current) {
                    clearTimeout(timerRef.current);
                    timerRef.current = null;
                    try {
                      await update(apiFromForm(getValues()));
                    } catch {
                      /* autosave error already toasted by watcher */
                    }
                  }
                  setSuspendOpen(true);
                }}
              >
                {tr('consult.suspend')}
              </Button>
              {/* Bouton "Certificat" du footer retiré (doublon du CTA principal
                  en haut + de l'action "Certificat médical" dans la colonne
                  Actions). Cf. retour terrain — bouton ambigu. */}
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
          <div className="cs-section-h">{tr('consult.actions.title')}</div>

          <div className="cs-actions-list">
            <ActionBtn
              icon="Pill"
              color="primary"
              label={tr('consult.actions.rx')}
              sub={
                prescriptions.length > 0
                  ? tr(
                      prescriptions.length > 1
                        ? 'consult.actions.rxSubCountPlural'
                        : 'consult.actions.rxSubCount',
                      { n: prescriptions.length },
                    )
                  : tr('consult.actions.rxSub')
              }
              disabled={isSigned || isSuspended || !consultation}
              onClick={() => setRxOpen('DRUG')}
            />
            <ActionBtn
              icon="Flask"
              label={tr('consult.actions.lab')}
              sub={tr('consult.actions.labSub')}
              disabled={isSigned || isSuspended || !consultation}
              onClick={() => setRxOpen('LAB')}
            />
            <ActionBtn
              icon="Scan"
              label={tr('consult.actions.imaging')}
              sub={tr('consult.actions.imagingSub')}
              disabled={isSigned || isSuspended || !consultation}
              onClick={() => setRxOpen('IMAGING')}
            />
            <ActionBtn
              icon="Doc"
              label={tr('consult.actions.cert')}
              sub={tr('consult.actions.certSub')}
              disabled={!consultation || isSigned || isSuspended}
              onClick={() => setCertificatOpen(true)}
            />
            <ActionBtn
              icon="Doc"
              label={tr('consult.actions.letter')}
              sub={tr('consult.actions.letterSub')}
              disabled={!consultation || isSigned || isSuspended}
              onClick={() => setConfrereOpen(true)}
            />
            <ActionBtn
              icon="Calendar"
              label={tr('consult.actions.followUp')}
              sub={tr('consult.actions.followUpSub')}
              disabled={!consultation}
              onClick={() => setFollowUpOpen(true)}
            />
            {/* Consentement éclairé — user request 2026-05-28 :
                « charger un consentement pour le faire signer par le patient,
                puis le scanner et l'intégrer au dossier ». Deux flux :
                  1) Générer un PDF vierge (imprimable + signable manuellement)
                  2) Importer le scan signé (PDF/photo) → attache au dossier. */}
            <ActionBtn
              icon="Doc"
              label={tr('consult.actions.consent')}
              sub={tr('consult.actions.consentSub')}
              disabled={!consultation || !consultation.patientId}
              onClick={() => setConsentOpen(true)}
            />
            <ActionBtn
              icon="Upload"
              label={tr('consult.actions.consentUpload')}
              sub={tr('consult.actions.consentUploadSub')}
              disabled={!consultation || !consultation.patientId}
              onClick={() => setConsentUploadOpen(true)}
            />
          </div>

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            {tr('consult.docs.title')}
          </div>
          <div className="cs-docs-list" style={{ fontSize: 12 }}>
            {prescriptions.length === 0 && confrereLetters.length === 0 && (
              <div style={{ color: 'var(--ink-3)' }}>{tr('consult.docs.none')}</div>
            )}
            {prescriptions.map((p) => {
              // Le libellé "Documents générés" doit refléter le type réel
              // (Ordonnance / Certificat / Bon d'analyses / Bon d'imagerie /
              // Arrêt de travail), pas un libellé "Ordonnance" hardcodé.
              const docMeta = metaForPrescription(p);
              const lineCount = p.lines.length;
              const titleSuffix =
                p.type === 'CERT' || p.type === 'SICK_LEAVE'
                  ? '' // un certificat n'a généralement qu'une ligne libellée "corps"
                  : ` · ${tr(lineCount > 1 ? 'consult.docs.linesPlural' : 'consult.docs.lines', { n: lineCount })}`;
              const subLabel =
                p.type === 'DRUG'
                  ? tr('consult.docs.type.drug')
                  : p.type === 'LAB'
                  ? tr('consult.docs.type.lab')
                  : p.type === 'IMAGING'
                  ? tr('consult.docs.type.imaging')
                  : p.type === 'CERT'
                  ? tr('consult.docs.type.cert')
                  : p.type === 'SICK_LEAVE'
                  ? tr('consult.docs.type.sickLeave')
                  : (p.type ?? '—');
              return (
              <div key={p.id}>
                <DocRow
                  title={`${docMeta.label}${titleSuffix}`}
                  meta={subLabel}
                  onClick={() => navigate(`/prescriptions/${p.id}`)}
                  {...(!isSigned && !isSuspended
                    ? {
                        onDelete: () => {
                          if (
                            !confirm(
                              tr('consult.docs.confirmDelete', { label: docMeta.label }),
                            )
                          )
                            return;
                          removePrescription(p.id)
                            .then(() => toast.success(tr('consult.docs.deleted')))
                            .catch((err: { response?: { status?: number; data?: { message?: string } } }) => {
                              const status = err.response?.status;
                              if (status === 409) {
                                toast.error(
                                  err.response?.data?.message ??
                                    tr('consult.docs.deleteInQueue'),
                                );
                              } else if (status === 400) {
                                toast.error(tr('consult.docs.deleteClosed'));
                              } else {
                                toast.error(tr('consult.docs.deleteFailed'));
                              }
                            });
                        },
                      }
                    : {})}
                />
                {/* readOnly=false même quand la consultation est SIGNEE :
                    le patient ramène ses résultats d'analyses / d'imagerie
                    plusieurs jours après la consultation, le médecin doit
                    pouvoir les attacher à tout moment (rapport Y. Boutaleb
                    2026-05-01). Le verrou portait à tort sur la signature
                    SOAP, alors que le résultat est un évènement post-visite. */}
                <PrescriptionResultsPanel prescription={p} readOnly={false} />
              </div>
              );
            })}
            {/* Courriers au confrère (documents patient type LETTRE_CONFRERE) —
                rattachés à la consultation, listés ici pour la traçabilité. */}
            {confrereLetters.map((letter) => (
              <DocRow
                key={letter.id}
                title={letter.title ?? tr('consult.docs.confrereLetter')}
                meta={tr('consult.docs.confrereLetterMeta')}
                onClick={() => { void downloadConfrereLetter(letter.id, letter.title); }}
              />
            ))}
          </div>

          {id && <ConsultationPrestationsPanel consultationId={id} readOnly={isSigned} />}

          <div className="cs-section-h" style={{ marginTop: 18 }}>
            {tr('consult.billing.title')}
          </div>
          <Panel className="cs-billing-panel">
            {activeStay && (
              <div
                role="note"
                style={{
                  margin: '10px 12px 0', padding: '8px 10px', borderRadius: 6,
                  background: 'var(--amber-soft, #FFF3CD)', border: '1px solid #E8CFA9',
                  fontSize: 11.5, color: 'var(--ink-2)', lineHeight: 1.4,
                }}
              >
                <strong>{tr('consult.billing.hospitalizedTitle')}</strong>{' '}
                {tr('consult.billing.hospitalizedNote')}
              </div>
            )}
            {!invoice && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--ink-3)' }}>
                {isSigned
                  ? tr('consult.billing.draftCreating')
                  : tr('consult.billing.draftOnSign')}
              </div>
            )}
            {invoice && (
              <div style={{ padding: '10px 12px', fontSize: 12 }}>
                <div className="cs-billing-row">
                  <span style={{ color: 'var(--ink-3)' }}>{tr('consult.billing.subtotal')}</span>
                  <span className="tnum">{invoice.totalAmount.toFixed(2).replace('.', ',')} MAD</span>
                </div>
                {invoice.discountAmount > 0 && (
                  <div className="cs-billing-row">
                    <span style={{ color: 'var(--ink-3)' }}>{tr('consult.billing.discount')}</span>
                    <span className="tnum">- {invoice.discountAmount.toFixed(2).replace('.', ',')} MAD</span>
                  </div>
                )}
                <div className="cs-billing-total">
                  <span>{tr('consult.billing.netDue')}</span>
                  <span className="tnum">{invoice.netAmount.toFixed(2).replace('.', ',')} MAD</span>
                </div>
                {!isSigned && id && (
                  <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={tr('consult.billing.discountPlaceholder')}
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
                            toast.success(tr('consult.billing.adjusted'));
                            setAdjustingDiscount(null);
                          })
                          .catch(() => toast.error(tr('consult.billing.adjustRefused')));
                      }}
                    >
                      {tr('consult.billing.adjust')}
                    </Button>
                  </div>
                )}
                {isSigned && (
                  <Button
                    size="sm"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                    onClick={() => navigate('/facturation')}
                  >
                    {tr('consult.billing.openInvoice')}
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
          <ConfrereLetterDialog
            open={confrereOpen}
            onOpenChange={setConfrereOpen}
            consultationId={id}
          />
        </>
      )}
      {consultation?.patientId && (
        <>
          <ConsentDialog
            open={consentOpen}
            onOpenChange={setConsentOpen}
            patientId={consultation.patientId}
          />
          <ConsentUploadDialog
            open={consentUploadOpen}
            onOpenChange={setConsentUploadOpen}
            patientId={consultation.patientId}
            consultationId={consultation.id}
          />
        </>
      )}
      {consultation?.patientId && (
        <PromoteDiagnosisDialog
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          patientId={consultation.patientId}
          initialDescription={watch('analyse') ?? ''}
          defaultOccurredOn={new Date().toISOString().slice(0, 10)}
        />
      )}
      <SuspendChoiceDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        hideCancelBranch={!consultation?.appointmentId}
        onSuspend={() => suspend()}
        onCancel={async (reason) => {
          if (!consultation?.appointmentId) return;
          await cancelAppointment(consultation.appointmentId, reason);
        }}
        onSuspended={() => {
          void navigate('/salle');
        }}
        onCancelled={() => {
          void navigate('/agenda');
        }}
      />
      <InvoiceDrawer
        invoice={invoice}
        open={postSignDialogOpen && !!invoice}
        onOpenChange={(o) => {
          if (!o) {
            setPostSignDialogOpen(false);
            // R038 — après signature + revue du brouillon de facture, on
            // ramène le médecin à la salle d'attente pour qu'il choisisse
            // son prochain patient (ce qu'il fait juste après une consult).
            // Avant : navigate('/facturation') — c'était la vue de la
            // secrétaire, le médecin la regardait rarement et perdait
            // l'enchainement de file d'attente.
            void navigate('/salle');
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
            {tr('consult.billing.generatingDraft')}
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
            toast.success(tr('consult.rxCreated'));
          }}
        />
      )}
    </Screen>
  );
}
