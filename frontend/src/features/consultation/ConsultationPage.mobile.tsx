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
import { Warn, Lock, ChevronRight, Trash } from '@/components/icons';
import { usePatient } from '@/features/dossier-patient/hooks/usePatient';
import { useInsurances } from '@/features/dossier-patient/hooks/useInsurances';
import { formatCoverage } from '@/features/dossier-patient/components/PatientHeader';
import { PrescriptionDrawer } from '@/features/prescription/PrescriptionDrawer';
import { PrescriptionResultsPanel } from '@/features/prescription/components/PrescriptionResultsPanel';
import { PromoteDiagnosisDialog } from './components/PromoteDiagnosisDialog';
import { SoapToolbarButtons } from './components/SoapToolbarButtons';
import { usePrescriptions } from '@/features/prescription/hooks/usePrescriptions';
import { useDeletePrescription } from '@/features/prescription/hooks/useDeletePrescription';
import { metaForPrescription } from '@/features/prescription/components/DocumentPdfViewer';
import type { PrescriptionType } from '@/features/prescription/types';
import { useInvoiceByConsultation } from '@/features/facturation/hooks/useInvoices';
import { InvoiceDrawer } from '@/features/facturation/InvoiceDrawer';
import { FollowUpDialog } from './components/FollowUpDialog';
import { CertificatDialog } from './components/CertificatDialog';
import { ConfrereLetterDialog } from '@/features/confrere/components/ConfrereLetterDialog';
import { useConfrereLetters } from '@/features/confrere/hooks/useConfrereLetters';
import { api } from '@/lib/api/client';
import { VitalIcon } from './components/VitalIcon';
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
  { key: 'analyse', letter: 'A', title: 'Appréciation' },
  { key: 'plan', letter: 'P', title: 'Plan' },
];

export default function ConsultationMobilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const { consultation, isLoading, update, isSaving } = useConsultation(id);
  const { patient } = usePatient(consultation?.patientId);
  const { insurances } = useInsurances();
  const { vitals } = useLatestVitals(consultation?.patientId, consultation?.id);
  const { sign, isSigning, signed } = useSignConsultation(id);
  const { prescriptions } = usePrescriptions(id);
  const { letters: confrereLetters } = useConfrereLetters(id);

  // Téléchargement courrier confrère (parité desktop, ADR-038) : <a download>.
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
      toast.error('Téléchargement du courrier impossible.');
    }
  }
  const { remove: removePrescription } = useDeletePrescription(id, consultation?.patientId);

  function handleDeletePrescription(prescriptionId: string, label: string) {
    if (!confirm(`Supprimer « ${label} » ? Cette ordonnance sera retirée de la consultation.`)) return;
    removePrescription(prescriptionId)
      .then(() => toast.success('Ordonnance supprimée.'))
      .catch((err: { response?: { status?: number; data?: { message?: string } } }) => {
        const status = err.response?.status;
        if (status === 409) {
          toast.error(
            err.response?.data?.message ?? 'Analyse/radio déjà en file interne — annulez-la d’abord.',
          );
        } else if (status === 400) {
          toast.error('Impossible : la consultation est clôturée.');
        } else {
          toast.error('Suppression de l’ordonnance impossible.');
        }
      });
  }
  const [rxOpen, setRxOpen] = useState<PrescriptionType | null>(null);
  const [postSignDialogOpen, setPostSignDialogOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [certificatOpen, setCertificatOpen] = useState(false);
  const [confrereOpen, setConfrereOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const { invoice } = useInvoiceByConsultation(id, { pollUntilFound: postSignDialogOpen });

  const isSigned = consultation?.status === 'SIGNEE' || signed;
  // R032 — une consultation SUSPENDUE n'est plus en BROUILLON côté BE → toute
  // tentative de création de prescription renvoie 400 CONSULT_LOCKED. Comme
  // sur desktop (commit 2030e55), on désactive les 4 boutons d'action quand
  // la consultation n'est pas en BROUILLON.
  const isSuspended = consultation?.status === 'SUSPENDUE' && !isSigned;

  const {
    register,
    watch,
    reset,
    getValues,
    setValue,
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
      toast.success('Consultation signée. Détail de la facturation ouvert.');
      // Parité desktop : ouvrir le drawer facture (édition lignes / remise /
      // émission) au lieu de rediriger directement. Le brouillon est créé en
      // AFTER_COMMIT — useInvoiceByConsultation poll jusqu'à apparition.
      setPostSignDialogOpen(true);
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
          {patient && (
            // V044/coverage-fix — show mutuelle inline so the praticien knows
            // if the patient is covered without opening the dossier.
            <div
              style={{
                fontSize: 11,
                color: patient.mutuelleInsuranceId ? 'var(--ink-2)' : 'var(--ink-3)',
                marginTop: 2,
              }}
            >
              {formatCoverage(patient, insurances)}
            </div>
          )}
        </div>
        {allergyLabel && (
          <span className="m-pill allergy">
            <Warn aria-hidden="true" /> {allergyLabel}
          </span>
        )}
      </div>

      <div className="mb-pad">
        {vitals && (
          // B1 (2026-05-06) — affiche TOUTES les constantes saisies sur la
          // visite (pas seulement TA/FC/T°/SpO₂). Les cellules sont rendues
          // de manière conditionnelle : pas d'affichage "—" pour les valeurs
          // jamais saisies, pour ne pas saturer l'écran mobile.
          <div className="cs-m-vitals-grid" role="region" aria-label="Constantes">
            {vitals.systolicMmhg != null && vitals.diastolicMmhg != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="ta" />TA
                </div>
                <div className="cs-m-vital-v">{taLabel}</div>
              </div>
            )}
            {vitals.heartRateBpm != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="fc" />FC
                </div>
                <div className="cs-m-vital-v">{vitals.heartRateBpm}</div>
              </div>
            )}
            {vitals.respiratoryRateBpm != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="fr" />FR
                </div>
                <div className="cs-m-vital-v">{vitals.respiratoryRateBpm}</div>
              </div>
            )}
            {vitals.temperatureC != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="temp" />T°
                </div>
                <div className="cs-m-vital-v">
                  {Number(vitals.temperatureC).toFixed(1).replace('.', ',')}
                </div>
              </div>
            )}
            {vitals.spo2Percent != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="spo2" />SpO₂
                </div>
                <div className="cs-m-vital-v">{vitals.spo2Percent}</div>
              </div>
            )}
            {vitals.weightKg != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="poids" />Poids
                </div>
                <div className="cs-m-vital-v">
                  {Number(vitals.weightKg).toFixed(1).replace('.', ',')}
                </div>
              </div>
            )}
            {vitals.heightCm != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="taille" />Taille
                </div>
                <div className="cs-m-vital-v">{Number(vitals.heightCm)}</div>
              </div>
            )}
            {vitals.bmi != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="imc" />IMC
                </div>
                <div className="cs-m-vital-v">
                  {Number(vitals.bmi).toFixed(1).replace('.', ',')}
                </div>
              </div>
            )}
            {vitals.glycemiaGPerL != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="glycemie" />Glycémie
                </div>
                <div className="cs-m-vital-v">
                  {Number(vitals.glycemiaGPerL).toFixed(2).replace('.', ',')}
                </div>
              </div>
            )}
            {vitals.abdominalPerimeterCm != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="abdo" />P. abdo
                </div>
                <div className="cs-m-vital-v">{Number(vitals.abdominalPerimeterCm)}</div>
              </div>
            )}
            {vitals.headCircumferenceCm != null && (
              <div className="cs-m-vital-cell">
                <div className="cs-m-vital-k">
                  <VitalIcon vital="cranien" />P. crânien
                </div>
                <div className="cs-m-vital-v">{Number(vitals.headCircumferenceCm)}</div>
              </div>
            )}
          </div>
        )}

        {isLoading && !consultation ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>
        ) : (
          <>
          {/* Modèles SOAP + CIM-10 — parité desktop (barre d'outils consultation). */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <SoapToolbarButtons
              disabled={isSigned}
              onApplyTemplate={(t) => {
                setValue('subjectif', t.subjectif ?? '', { shouldDirty: true });
                setValue('objectif', t.objectif ?? '', { shouldDirty: true });
                setValue('analyse', t.analyse ?? '', { shouldDirty: true });
                setValue('plan', t.plan ?? '', { shouldDirty: true });
                toast.success(`Modèle « ${t.name} » appliqué.`);
              }}
              onInsertCim={(text) => {
                const cur = getValues('analyse') ?? '';
                setValue('analyse', cur.trim() ? `${cur}\n${text}` : text, { shouldDirty: true });
                toast.success('Code CIM-10 ajouté à l\'analyse.');
              }}
            />
          </div>
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
                {s.key === 'analyse' && consultation?.patientId && (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={() => setPromoteOpen(true)}
                      disabled={!watch('analyse')?.trim()}
                      style={{
                        fontSize: 12,
                        padding: '6px 10px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--surface)',
                        cursor: 'pointer',
                      }}
                    >
                      + Ajouter aux antécédents
                    </button>
                  </div>
                )}
              </div>
            ))}
          </form>
          </>
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

        {/* Prescriptions creation buttons (DRUG / LAB / IMAGING). */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            className="m-btn"
            style={{ height: 40, fontSize: 12 }}
            disabled={isSigned || isSuspended || !consultation}
            onClick={() => setRxOpen('DRUG')}
          >
            Médic.
          </button>
          <button
            type="button"
            className="m-btn"
            style={{ height: 40, fontSize: 12 }}
            disabled={isSigned || isSuspended || !consultation}
            onClick={() => setRxOpen('LAB')}
          >
            Analyses
          </button>
          <button
            type="button"
            className="m-btn"
            style={{ height: 40, fontSize: 12 }}
            disabled={isSigned || isSuspended || !consultation}
            onClick={() => setRxOpen('IMAGING')}
          >
            Imagerie
          </button>
          <button
            type="button"
            className="m-btn"
            style={{ height: 40, fontSize: 12 }}
            disabled={isSigned || isSuspended || !consultation}
            onClick={() => setCertificatOpen(true)}
          >
            Certificat
          </button>
          <button
            type="button"
            className="m-btn"
            style={{ height: 40, fontSize: 12 }}
            disabled={isSigned || isSuspended || !consultation}
            onClick={() => setConfrereOpen(true)}
          >
            Courrier
          </button>
          <button
            type="button"
            className="m-btn"
            style={{ height: 40, fontSize: 12 }}
            disabled={!consultation}
            onClick={() => setFollowUpOpen(true)}
          >
            Prochain RDV
          </button>
        </div>

        {/* Documents générés — list of prescriptions for this consultation. */}
        <div className="m-section-h" style={{ marginTop: 18 }}>
          <h3>Documents générés</h3>
          {prescriptions.length + confrereLetters.length > 0 && (
            <span className="more">{prescriptions.length + confrereLetters.length}</span>
          )}
        </div>
        {prescriptions.length === 0 && confrereLetters.length === 0 ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '8px 0' }}>
            Aucun document généré pour cette consultation.
          </div>
        ) : (
          <div className="m-card">
            {prescriptions.map((p, i) => {
              // Libellés type-aware : un certificat ne doit pas s'afficher
              // "Ordonnance" en mobile (parité bug B2 desktop).
              const docMeta = metaForPrescription(p);
              const typeLabel =
                p.type === 'DRUG'
                  ? 'Médicaments'
                  : p.type === 'LAB'
                  ? 'Analyses'
                  : p.type === 'IMAGING'
                  ? 'Imagerie'
                  : p.type === 'CERT'
                  ? 'Certificat médical'
                  : p.type === 'SICK_LEAVE'
                  ? 'Arrêt de travail'
                  : (p.type ?? '—');
              const isLetter = p.type === 'CERT' || p.type === 'SICK_LEAVE';
              const titleSuffix = isLetter
                ? ''
                : ` · ${p.lines.length} ligne${p.lines.length > 1 ? 's' : ''}`;
              return (
                <div key={p.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/prescriptions/${p.id}`)}
                  className="m-row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 0,
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                    fontFamily: 'inherit',
                    font: 'inherit',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  <div className="m-row-pri">
                    <div className="m-row-main">
                      {docMeta.label}{titleSuffix}
                    </div>
                    <div className="m-row-sub">
                      {typeLabel} ·{' '}
                      {new Date(p.issuedAt).toLocaleDateString('fr-MA', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                  <ChevronRight aria-hidden="true" />
                </button>
                {/* V045 — panneau résultat (PDF + saisie texte) ; le composant
                    ne rend rien pour DRUG/CERT/SICK_LEAVE et reste réactif post-
                    signature pour permettre l'attachement tardif (cf. desktop). */}
                <PrescriptionResultsPanel prescription={p} readOnly={false} />
                {!isSigned && !isSuspended && (
                  <button
                    type="button"
                    onClick={() => handleDeletePrescription(p.id, docMeta.label)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: 'transparent',
                      border: 0,
                      color: 'var(--danger)',
                      fontFamily: 'inherit',
                      fontSize: 12,
                      padding: '6px 2px',
                      cursor: 'pointer',
                    }}
                  >
                    <Trash aria-hidden="true" /> Supprimer
                  </button>
                )}
                </div>
              );
            })}
            {confrereLetters.map((letter, i) => (
              <button
                key={letter.id}
                type="button"
                onClick={() => { void downloadConfrereLetter(letter.id, letter.title); }}
                className="m-row"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 0,
                  borderTop: prescriptions.length === 0 && i === 0 ? 'none' : '1px solid var(--border-soft)',
                  fontFamily: 'inherit',
                  font: 'inherit',
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div className="m-row-pri">
                  <div className="m-row-main">{letter.title ?? 'Courrier au confrère'}</div>
                  <div className="m-row-sub">Courrier confrère</div>
                </div>
                <ChevronRight aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        <div className="cs-m-action-row" style={{ marginTop: 18 }}>
          <button
            type="button"
            className="m-btn primary"
            style={{ height: 44, gridColumn: '1 / -1' }}
            disabled={isSigned || !consultation || isSigning}
            onClick={() => {
              void handleSign();
            }}
          >
            <Lock aria-hidden="true" /> {isSigned ? 'Signée' : 'Clôturer la consultation'}
          </button>
        </div>
      </div>
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
            // Stay on the consultation — the doctor can chain prescriptions
            // (DRUG + LAB + IMAGING). The new entry appears immediately in
            // "Documents générés" via the consultation query invalidation.
            setRxOpen(null);
            toast.success('Ordonnance créée.');
          }}
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
        <PromoteDiagnosisDialog
          open={promoteOpen}
          onOpenChange={setPromoteOpen}
          patientId={consultation.patientId}
          initialDescription={watch('analyse') ?? ''}
          defaultOccurredOn={new Date().toISOString().slice(0, 10)}
        />
      )}
      <InvoiceDrawer
        invoice={invoice}
        open={postSignDialogOpen && !!invoice}
        onOpenChange={(o) => {
          if (!o) {
            setPostSignDialogOpen(false);
            // R038 — cf. desktop : médecin → salle d'attente après revue de
            // facture, pas vers la liste facturation (secrétaire).
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
              padding: 20,
              fontSize: 13,
              boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            }}
          >
            Génération du brouillon de facture en cours…
          </div>
        </div>
      )}
    </MScreen>
  );
}
