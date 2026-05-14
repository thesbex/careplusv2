/**
 * Screen 13 — Onboarding wizard (first-launch, 7 steps).
 *
 * Faithful port of `design/prototype/screens/onboarding.jsx`. Steps mirror
 * the prototype exactly:
 *
 *   1. Cabinet     → PUT /api/settings/clinic
 *   2. Médecin     → PUT /api/admin/users/{id} (specialty + INPE + CNOM + CNOPS)
 *                   + PUT /api/practitioners/{id}/signature
 *   3. Horaires    → PUT /api/settings/working-hours (replace-all)
 *   4. Équipe      → POST /api/admin/users (loop)
 *   5. Tarifs      → PUT /api/settings/tiers/PREMIUM
 *   6. Documents   → GET /api/settings/document-templates (read-only preview)
 *   7. Prêt        → navigate /agenda
 *
 * The wizard assumes the admin is already signed in (post-register flow).
 * Each step's "Continuer" is the commit point — the user can never advance
 * with un-saved data. "Passer cette étape" exists when the step has a sane
 * default (Médecin credentials, Horaires, Tarifs, Documents).
 */
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandMark, BrandWordmark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Panel } from '@/components/ui/Panel';
import { Pill } from '@/components/ui/Pill';
import { Check, ChevronLeft, ChevronRight } from '@/components/icons';
import {
  useClinicSettings,
  useUpdateClinicSettings,
  useTiers,
  useUpdateTierDiscount,
  type ClinicSettingsForm,
} from '@/features/parametres/hooks/useSettings';
import { useCreateUser, useUsers, type AdminUser } from '@/features/parametres/hooks/useUsers';
import {
  useWorkingHours,
  useUpdateWorkingHours,
  useDocumentTemplates,
  useMeProfile,
  useUpdatePractitionerCredentials,
  useUserSignature,
  useUploadUserSignature,
  useCatalogActs,
  TEMPLATE_TYPE_LABELS,
  type ActMeta,
  type WorkingHoursDay,
  type WorkingHoursView,
  type PractitionerCredentialsForm,
} from './hooks/useOnboardingApi';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import { api } from '@/lib/api/client';
import { OnboardingSidebar } from './components/OnboardingSidebar';
import { AddDoctorModal } from './components/AddDoctorModal';
import './onboarding.css';

type StepKey =
  | 'cabinet'
  | 'medecin'
  | 'horaires'
  | 'equipe'
  | 'tarifs'
  | 'documents'
  | 'recap';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'medecin', label: 'Médecin' },
  { key: 'horaires', label: 'Horaires' },
  { key: 'equipe', label: 'Équipe' },
  { key: 'tarifs', label: 'Tarifs' },
  { key: 'documents', label: 'Documents' },
  { key: 'recap', label: 'Prêt' },
];

const EMPTY_CLINIC: ClinicSettingsForm = {
  name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  inpe: '',
  cnom: '',
  ice: '',
  rib: '',
};

interface InvitedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'SECRETAIRE' | 'ASSISTANT' | 'MEDECIN' | 'ADMIN';
}

const HOUR_TEMPLATES: { key: string; label: string; sub: string; week: WorkingHoursView }[] = [
  {
    key: 'classique',
    label: 'Cabinet classique',
    sub: 'Lun–Sam, 8:30–19:00',
    week: {
      days: [1, 2, 3, 4, 5].map((d) => ({
        dayOfWeek: d,
        active: true,
        slots: [
          { startTime: '08:30', endTime: '12:30' },
          { startTime: '14:30', endTime: '19:00' },
        ],
      })).concat([
        { dayOfWeek: 6, active: true, slots: [{ startTime: '09:00', endTime: '13:00' }] },
        { dayOfWeek: 7, active: false, slots: [] },
      ]),
    },
  },
  {
    key: 'continue',
    label: 'Journée continue',
    sub: 'Lun–Ven, 9:00–17:00',
    week: {
      days: [1, 2, 3, 4, 5].map((d) => ({
        dayOfWeek: d,
        active: true,
        slots: [{ startTime: '09:00', endTime: '17:00' }],
      })).concat([
        { dayOfWeek: 6, active: false, slots: [] },
        { dayOfWeek: 7, active: false, slots: [] },
      ]),
    },
  },
  {
    key: 'matinees',
    label: 'Demi-journées',
    sub: 'Matins seulement',
    week: {
      days: [1, 2, 3, 4, 5, 6].map((d) => ({
        dayOfWeek: d,
        active: true,
        slots: [{ startTime: '08:30', endTime: '13:00' }],
      })).concat([
        { dayOfWeek: 7, active: false, slots: [] },
      ]),
    },
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const sessionUser = useAuthStore((s) => s.user);
  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx]!;

  // Step 1 — Cabinet
  const { settings } = useClinicSettings();
  const { update: updateClinic, isPending: isSavingClinic } = useUpdateClinicSettings();
  const [clinic, setClinic] = useState<ClinicSettingsForm>(EMPTY_CLINIC);
  useEffect(() => {
    if (settings) {
      setClinic({
        name: settings.name ?? '',
        address: settings.address ?? '',
        city: settings.city ?? '',
        phone: settings.phone ?? '',
        email: settings.email ?? '',
        inpe: settings.inpe ?? '',
        cnom: settings.cnom ?? '',
        ice: settings.ice ?? '',
        rib: settings.rib ?? '',
      });
    }
  }, [settings]);

  // Step 2 — Médecin
  const { me } = useMeProfile();
  const { users: allUsers } = useUsers();
  const doctors = allUsers.filter((u) => u.roles.includes('MEDECIN'));
  const [showAddDoctor, setShowAddDoctor] = useState(false);
  const { updateCredentials, isPending: isSavingMedecin } = useUpdatePractitionerCredentials();
  const { signatureMeta } = useUserSignature(sessionUser?.id ?? null);
  const { upload: uploadSignature, isPending: isUploadingSig } = useUploadUserSignature();
  const [credentials, setCredentials] = useState<PractitionerCredentialsForm>({
    specialty: '', inpe: '', cnom: '', cnops: '',
  });
  useEffect(() => {
    if (me) {
      setCredentials({
        specialty: me.specialty ?? '',
        inpe: me.inpe ?? '',
        cnom: me.cnom ?? '',
        cnops: me.cnops ?? '',
      });
    }
  }, [me]);

  // Step 3 — Horaires
  const { workingHours } = useWorkingHours();
  const { updateWorkingHours, isPending: isSavingHours } = useUpdateWorkingHours();
  const [hours, setHours] = useState<WorkingHoursView>(workingHours);
  useEffect(() => { setHours(workingHours); }, [workingHours]);

  // Step 4 — Équipe (reuses existing flow)
  const { createUser, isPending: isCreatingUser } = useCreateUser();
  const [invited, setInvited] = useState<InvitedUser[]>([]);
  const [draft, setDraft] = useState<InvitedUser>({
    email: '', password: '', firstName: '', lastName: '', phone: '', role: 'SECRETAIRE',
  });

  // Step 5 — Tarifs
  const { tiers } = useTiers();
  const { updateTier, isPending: isSavingTier } = useUpdateTierDiscount();
  const { acts } = useCatalogActs();
  const premium = tiers.find((t) => t.tier === 'PREMIUM');
  const [premiumDiscount, setPremiumDiscount] = useState(0);
  useEffect(() => {
    if (premium) setPremiumDiscount(Number(premium.discountPercent));
  }, [premium]);

  // Step 6 — Documents
  const { templates } = useDocumentTemplates();

  function setClinicField<K extends keyof ClinicSettingsForm>(k: K, v: ClinicSettingsForm[K]) {
    setClinic((c) => ({ ...c, [k]: v }));
  }

  async function handleNext() {
    if (step.key === 'cabinet') {
      if (!clinic.name || !clinic.address || !clinic.city || !clinic.phone) {
        toast.error('Nom, adresse, ville et téléphone sont obligatoires.');
        return;
      }
      try {
        await updateClinic(clinic);
        toast.success('Cabinet enregistré.');
        setStepIdx((i) => i + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'medecin') {
      if (!sessionUser?.id) {
        toast.error('Session invalide — reconnectez-vous.');
        return;
      }
      try {
        await updateCredentials({ userId: sessionUser.id, form: credentials });
        toast.success('Profil médecin enregistré.');
        setStepIdx((i) => i + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'horaires') {
      try {
        await updateWorkingHours(hours);
        toast.success('Horaires enregistrés.');
        setStepIdx((i) => i + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'equipe') {
      setStepIdx((i) => i + 1);
    } else if (step.key === 'tarifs') {
      try {
        await updateTier({ tier: 'PREMIUM', discountPercent: premiumDiscount });
        toast.success('Tarifs enregistrés.');
        setStepIdx((i) => i + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'documents') {
      // Read-only step — just advance.
      setStepIdx((i) => i + 1);
    } else if (step.key === 'recap') {
      navigate('/agenda');
    }
  }

  async function handleAddInvited() {
    if (!draft.email || draft.password.length < 12 || !draft.firstName || !draft.lastName) {
      toast.error('Email, mot de passe (≥ 12 car.), prénom et nom requis.');
      return;
    }
    try {
      await createUser({
        email: draft.email,
        password: draft.password,
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        roles: [draft.role],
      });
      setInvited((list) => [...list, draft]);
      setDraft({ email: '', password: '', firstName: '', lastName: '', phone: '', role: 'SECRETAIRE' });
      toast.success('Membre ajouté.');
    } catch (err) {
      const p = toProblemDetail(err);
      toast.error(p.title, p.detail ? { description: p.detail } : undefined);
    }
  }

  async function handleSignatureFile(file: File) {
    if (!sessionUser?.id) return;
    try {
      await uploadSignature({ userId: sessionUser.id, file });
      toast.success('Signature téléversée.');
    } catch (err) {
      const p = toProblemDetail(err);
      toast.error(p.title, p.detail ? { description: p.detail } : undefined);
    }
  }

  const sessionLabel = sessionUser
    ? `Dr. ${sessionUser.firstName} ${sessionUser.lastName}`.trim()
    : '—';

  async function handleLogout() {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // swallow — logout should always clear local state even if BE 5xx
    }
    useAuthStore.getState().clear();
    navigate('/login', { replace: true });
  }
  const isPending =
    isSavingClinic || isSavingTier || isCreatingUser || isSavingMedecin || isSavingHours;

  // Compute footer label dynamically — mirrors the prototype "Continuer — <next>"
  const nextLabel = stepIdx < STEPS.length - 1 ? STEPS[stepIdx + 1]!.label : null;

  return (
    <div className="ob-root">
      <header className="ob-topbar">
        <BrandMark size="sm" />
        <span className="ob-topbar-name">
          <BrandWordmark />
        </span>
        <Pill style={{ marginLeft: 10 }}>Configuration initiale</Pill>
        <span className="ob-topbar-session">Session : {sessionLabel}</span>
        <button
          type="button"
          className="ob-topbar-logout"
          onClick={() => void handleLogout()}
          aria-label="Se déconnecter"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Déconnexion
        </button>
      </header>

      <nav className="ob-rail" aria-label="Étapes de configuration">
        <ol className="ob-steps">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            const isLast = i === STEPS.length - 1;
            return (
              <Fragment key={s.key}>
                <li
                  className={`ob-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                  aria-current={active ? 'step' : undefined}
                >
                  <span className="ob-step-circle">{done ? <Check /> : i + 1}</span>
                  <span className="ob-step-label">{s.label}</span>
                </li>
                {!isLast && (
                  <li
                    aria-hidden="true"
                    className={`ob-step-connector ${done ? 'done' : ''}`}
                  />
                )}
              </Fragment>
            );
          })}
        </ol>
      </nav>

      <div className="ob-body">
        <div className="ob-content scroll">
          <div className="ob-content-inner">
            <div className="ob-eyebrow">Étape {stepIdx + 1} sur {STEPS.length}</div>

            {step.key === 'cabinet' && (
              <CabinetStep clinic={clinic} setField={setClinicField} />
            )}

            {step.key === 'medecin' && (
              <MedecinStep
                credentials={credentials}
                setCredentials={setCredentials}
                onSignatureFile={(f) => void handleSignatureFile(f)}
                hasSignature={!!signatureMeta}
                isUploadingSig={isUploadingSig}
                currentUserId={sessionUser?.id ?? null}
                doctors={doctors}
                onAddClick={() => setShowAddDoctor(true)}
              />
            )}

            {step.key === 'horaires' && (
              <HorairesStep hours={hours} setHours={setHours} />
            )}

            {step.key === 'equipe' && (
              <EquipeStep
                draft={draft}
                setDraft={setDraft}
                invited={invited}
                onAdd={() => void handleAddInvited()}
                isPending={isPending}
              />
            )}

            {step.key === 'tarifs' && (
              <TarifsStep
                premiumDiscount={premiumDiscount}
                setPremiumDiscount={setPremiumDiscount}
                acts={acts}
              />
            )}

            {step.key === 'documents' && (
              <DocumentsStep templates={templates} />
            )}

            {step.key === 'recap' && (
              <RecapStep
                clinicName={clinic.name}
                city={clinic.city}
                invitedCount={invited.length}
                specialty={credentials.specialty}
                hasSignature={!!signatureMeta}
                templateCount={templates.length}
                activeDays={hours.days.filter((d) => d.active).length}
              />
            )}
          </div>
        </div>

        <OnboardingSidebar
          step={step.key}
          hours={hours}
          premiumDiscount={premiumDiscount}
          invitedCount={invited.length}
          hasSignature={!!signatureMeta}
        />
      </div>

      <footer className="ob-footer">
        <Button
          onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
          disabled={stepIdx === 0 || isPending}
        >
          <ChevronLeft /> Précédent
        </Button>
        <div className="ob-footer-right">
          {step.key !== 'recap' && (
            <Button variant="ghost" onClick={() => setStepIdx((i) => i + 1)} disabled={isPending}>
              Passer cette étape
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={() => void handleNext()}
            disabled={isPending}
          >
            {step.key === 'recap'
              ? 'Ouvrir mon cabinet'
              : isPending
                ? 'Enregistrement…'
                : nextLabel
                  ? `Continuer — ${nextLabel}`
                  : 'Continuer'}
            {step.key !== 'recap' && <ChevronRight />}
          </Button>
        </div>
      </footer>

      {showAddDoctor && <AddDoctorModal onClose={() => setShowAddDoctor(false)} />}
    </div>
  );
}

// ── Step components ──────────────────────────────────────────────────────────

function CabinetStep({
  clinic,
  setField,
}: {
  clinic: ClinicSettingsForm;
  setField: <K extends keyof ClinicSettingsForm>(k: K, v: ClinicSettingsForm[K]) => void;
}) {
  return (
    <>
      <h1 className="ob-title">Identité du cabinet</h1>
      <p className="ob-sub">
        Ces informations apparaissent sur les ordonnances et factures (mentions légales obligatoires).
      </p>
      <Panel className="ob-form-panel">
        <Grid2>
          <Field>
            <FieldLabel>Nom du cabinet *</FieldLabel>
            <Input value={clinic.name} onChange={(e) => setField('name', e.target.value)} placeholder="Cabinet Médical El Amrani" />
          </Field>
          <Field>
            <FieldLabel>Téléphone *</FieldLabel>
            <Input value={clinic.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+212 5 22 47 85 20" />
          </Field>
        </Grid2>
        <Field>
          <FieldLabel>Adresse *</FieldLabel>
          <Input value={clinic.address} onChange={(e) => setField('address', e.target.value)} placeholder="24, Rue Tahar Sebti — Quartier Gauthier" />
        </Field>
        <Grid2>
          <Field>
            <FieldLabel>Ville *</FieldLabel>
            <Input value={clinic.city} onChange={(e) => setField('city', e.target.value)} placeholder="Casablanca" />
          </Field>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input value={clinic.email} onChange={(e) => setField('email', e.target.value)} placeholder="contact@cabinet.ma" />
          </Field>
        </Grid2>
        <h3 className="ob-section-title">Mentions légales</h3>
        <Grid2>
          <Field>
            <FieldLabel>INPE</FieldLabel>
            <Input value={clinic.inpe} onChange={(e) => setField('inpe', e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>CNOM</FieldLabel>
            <Input value={clinic.cnom} onChange={(e) => setField('cnom', e.target.value)} />
          </Field>
        </Grid2>
        <Grid2>
          <Field>
            <FieldLabel>ICE</FieldLabel>
            <Input value={clinic.ice} onChange={(e) => setField('ice', e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>RIB</FieldLabel>
            <Input value={clinic.rib} onChange={(e) => setField('rib', e.target.value)} />
          </Field>
        </Grid2>
      </Panel>
    </>
  );
}

function MedecinStep({
  credentials,
  setCredentials,
  onSignatureFile,
  hasSignature,
  isUploadingSig,
  currentUserId,
  doctors,
  onAddClick,
}: {
  credentials: PractitionerCredentialsForm;
  setCredentials: (form: PractitionerCredentialsForm) => void;
  onSignatureFile: (file: File) => void;
  hasSignature: boolean;
  isUploadingSig: boolean;
  currentUserId: string | null;
  doctors: AdminUser[];
  onAddClick: () => void;
}) {
  return (
    <>
      <h1 className="ob-title">Qui exerce dans le cabinet&nbsp;?</h1>
      <p className="ob-sub">
        Listez tous les médecins du cabinet — vous-même et vos associés. Chacun aura son propre compte,
        sa signature numérique et son agenda personnel.
      </p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
          Médecins du cabinet · {doctors.length}
        </div>
      </div>

      {doctors.map((d) => {
        const isMe = d.id === currentUserId;
        return (
          <Panel key={d.id} className="ob-form-panel" style={{ padding: 0, marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 18px',
                borderBottom: '1px solid var(--border)',
                background: isMe
                  ? 'linear-gradient(180deg, var(--primary-soft), transparent)'
                  : 'var(--surface-2)',
              }}
            >
              <Avatar firstName={d.firstName} lastName={d.lastName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em' }}>
                    Dr. {d.firstName} {d.lastName}
                  </span>
                  {isMe && (
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        background: 'var(--primary)',
                        color: '#fff',
                        borderRadius: 3,
                        fontWeight: 600,
                        letterSpacing: '0.02em',
                      }}
                    >
                      VOUS
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                  {isMe ? 'Administrateur principal' : 'Médecin associé'} · {d.email}
                </div>
              </div>
            </div>

            {isMe ? (
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Grid2>
                  <Field>
                    <FieldLabel>Spécialité</FieldLabel>
                    <Input
                      value={credentials.specialty}
                      onChange={(e) =>
                        setCredentials({ ...credentials, specialty: e.target.value })
                      }
                      placeholder="Médecine générale"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>N° INPE</FieldLabel>
                    <Input
                      value={credentials.inpe}
                      onChange={(e) => setCredentials({ ...credentials, inpe: e.target.value })}
                      placeholder="12 / 458 / 21"
                    />
                  </Field>
                </Grid2>
                <Grid2>
                  <Field>
                    <FieldLabel>N° Ordre (CNOM)</FieldLabel>
                    <Input
                      value={credentials.cnom}
                      onChange={(e) => setCredentials({ ...credentials, cnom: e.target.value })}
                      placeholder="CNOM-7841-CASA"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>N° conv. CNOPS</FieldLabel>
                    <Input
                      value={credentials.cnops}
                      onChange={(e) => setCredentials({ ...credentials, cnops: e.target.value })}
                      placeholder="2018-MG-4521"
                    />
                  </Field>
                </Grid2>
                <SignatureRow
                  onSignatureFile={onSignatureFile}
                  hasSignature={hasSignature}
                  isUploadingSig={isUploadingSig}
                />
              </div>
            ) : (
              <div
                style={{
                  padding: '14px 18px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px 22px',
                }}
              >
                <DoctorField label="Spécialité" value={d.specialty} />
                <DoctorField label="N° INPE" value={d.inpe} mono />
                <DoctorField label="N° Ordre CNOM" value={d.cnom} mono />
                <DoctorField label="N° conv. CNOPS" value={d.cnops} mono />
                <DoctorField
                  label="Signature"
                  value={d.hasSignature ? 'Téléversée' : 'À configurer'}
                  tone={d.hasSignature ? 'ok' : 'warn'}
                />
              </div>
            )}
          </Panel>
        );
      })}

      <button
        type="button"
        onClick={onAddClick}
        style={{
          width: '100%',
          padding: 18,
          textAlign: 'center',
          border: '1.5px dashed var(--border-strong)',
          background: 'transparent',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--primary)', fontWeight: 600, marginBottom: 4 }}>
          + Ajouter un médecin associé
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          Crée son compte avec sa spécialité et ses identifiants professionnels.
        </div>
      </button>
    </>
  );
}

function Avatar({ firstName, lastName }: { firstName: string; lastName: string }) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
  return (
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: '50%',
        background: 'var(--primary)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: 14,
        fontWeight: 700,
        letterSpacing: '0.02em',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initials || '·'}
    </div>
  );
}

function DoctorField({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  tone?: 'ok' | 'warn';
}) {
  const empty = !value;
  const color =
    tone === 'ok'
      ? '#2F8F6B'
      : tone === 'warn'
        ? '#C68A2E'
        : empty
          ? 'var(--ink-3)'
          : 'var(--ink)';
  return (
    <div>
      <div
        style={{
          fontSize: 10.5,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 550,
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? 'tnum' : ''}
        style={{ fontSize: 13, fontWeight: 500, color }}
      >
        {value || '—'}
      </div>
    </div>
  );
}

function SignatureRow({
  onSignatureFile,
  hasSignature,
  isUploadingSig,
}: {
  onSignatureFile: (file: File) => void;
  hasSignature: boolean;
  isUploadingSig: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '10px 0 0',
        borderTop: '1px dashed var(--border)',
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          color: 'var(--ink-3)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          fontWeight: 550,
          minWidth: 80,
        }}
      >
        Signature
      </span>
      <label
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          border: '1px dashed var(--border-strong)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          color: 'var(--ink-2)',
          background: 'var(--surface)',
        }}
      >
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSignatureFile(f);
          }}
          style={{ display: 'none' }}
        />
        {isUploadingSig
          ? 'Téléversement…'
          : hasSignature
            ? 'Remplacer'
            : 'Téléverser (PNG/JPEG, ≤ 500 Ko)'}
      </label>
      {hasSignature && (
        <span
          style={{
            fontSize: 12,
            color: '#2F8F6B',
            display: 'inline-flex',
            gap: 4,
            alignItems: 'center',
          }}
        >
          <Check /> Enregistrée
        </span>
      )}
    </div>
  );
}

const DAY_LABELS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function HorairesStep({
  hours,
  setHours,
}: {
  hours: WorkingHoursView;
  setHours: (h: WorkingHoursView) => void;
}) {
  function setDay(dow: number, mut: (d: WorkingHoursDay) => WorkingHoursDay) {
    setHours({
      days: hours.days.map((d) => (d.dayOfWeek === dow ? mut(d) : d)),
    });
  }

  function applyTemplate(weekKey: string) {
    const tpl = HOUR_TEMPLATES.find((t) => t.key === weekKey);
    if (tpl) setHours(tpl.week);
  }

  return (
    <>
      <h1 className="ob-title">Quand recevez-vous vos patients&nbsp;?</h1>
      <p className="ob-sub">
        Ces horaires déterminent les créneaux proposés par l’agenda et les messages envoyés aux patients.
        Vous pourrez les modifier à tout moment depuis les paramètres.
      </p>

      <div className="ob-section">
        <div className="ob-section-label">Démarrer depuis un modèle</div>
        <div className="ob-templates">
          {HOUR_TEMPLATES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="ob-template"
              onClick={() => applyTemplate(m.key)}
            >
              <span className="ob-template-t">{m.label}</span>
              <span className="ob-template-sub">{m.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <Panel className="ob-hours">
        {hours.days.map((d) => {
          const m = d.slots[0] ?? { startTime: '', endTime: '' };
          const a = d.slots[1] ?? { startTime: '', endTime: '' };
          return (
            <div key={d.dayOfWeek} className="ob-hours-row">
              <span className="ob-hours-day">{DAY_LABELS[d.dayOfWeek]}</span>
              <label className="ob-hours-toggle">
                <input
                  type="checkbox"
                  checked={d.active}
                  onChange={(e) =>
                    setDay(d.dayOfWeek, (cur) => ({
                      ...cur,
                      active: e.target.checked,
                      slots: e.target.checked && cur.slots.length === 0
                        ? [{ startTime: '09:00', endTime: '13:00' }]
                        : cur.slots,
                    }))
                  }
                />
                {d.active ? 'Ouvert' : 'Fermé'}
              </label>
              {d.active ? (
                <>
                  <div className="ob-hours-range">
                    <Input
                      type="time"
                      value={m.startTime}
                      onChange={(e) =>
                        setDay(d.dayOfWeek, (cur) => ({
                          ...cur,
                          slots: [
                            { startTime: e.target.value, endTime: m.endTime },
                            ...cur.slots.slice(1),
                          ],
                        }))
                      }
                      style={{ height: 32 }}
                    />
                    <span>–</span>
                    <Input
                      type="time"
                      value={m.endTime}
                      onChange={(e) =>
                        setDay(d.dayOfWeek, (cur) => ({
                          ...cur,
                          slots: [
                            { startTime: m.startTime, endTime: e.target.value },
                            ...cur.slots.slice(1),
                          ],
                        }))
                      }
                      style={{ height: 32 }}
                    />
                  </div>
                  <div className="ob-hours-range">
                    {a.startTime || a.endTime ? (
                      <>
                        <Input
                          type="time"
                          value={a.startTime}
                          onChange={(e) =>
                            setDay(d.dayOfWeek, (cur) => {
                              const slots = [...cur.slots];
                              slots[1] = { startTime: e.target.value, endTime: a.endTime };
                              return { ...cur, slots };
                            })
                          }
                          style={{ height: 32 }}
                        />
                        <span>–</span>
                        <Input
                          type="time"
                          value={a.endTime}
                          onChange={(e) =>
                            setDay(d.dayOfWeek, (cur) => {
                              const slots = [...cur.slots];
                              slots[1] = { startTime: a.startTime, endTime: e.target.value };
                              return { ...cur, slots };
                            })
                          }
                          style={{ height: 32 }}
                        />
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setDay(d.dayOfWeek, (cur) => ({
                            ...cur,
                            slots: [
                              ...cur.slots,
                              { startTime: '14:00', endTime: '18:00' },
                            ],
                          }))
                        }
                        style={{
                          fontSize: 11.5,
                          color: 'var(--primary)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontFamily: 'inherit',
                        }}
                      >
                        + Ajouter après-midi
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="ob-hours-empty">—</span>
                  <span className="ob-hours-empty">—</span>
                </>
              )}
              <span />
            </div>
          );
        })}
      </Panel>

      <div className="ob-options">
        <label>
          <input type="checkbox" defaultChecked /> Pause déjeuner automatique
        </label>
        <label>
          <input type="checkbox" /> Créneau urgences réservé
        </label>
        <label>
          <input type="checkbox" defaultChecked /> Respecter les jours fériés marocains
        </label>
      </div>
    </>
  );
}

function EquipeStep({
  draft,
  setDraft,
  invited,
  onAdd,
  isPending,
}: {
  draft: InvitedUser;
  setDraft: (next: InvitedUser) => void;
  invited: InvitedUser[];
  onAdd: () => void;
  isPending: boolean;
}) {
  return (
    <>
      <h1 className="ob-title">Qui travaille avec vous&nbsp;?</h1>
      <p className="ob-sub">
        Ajoutez votre secrétaire, infirmier·e et médecins associés. Chacun reçoit un accès personnel avec ses
        propres droits — vous restez maître du périmètre exact.
      </p>
      <Panel className="ob-form-panel">
        <Grid2>
          <Field>
            <FieldLabel>Prénom</FieldLabel>
            <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel>Nom</FieldLabel>
            <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
        </Grid2>
        <Grid2>
          <Field>
            <FieldLabel>Email</FieldLabel>
            <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel>Téléphone</FieldLabel>
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
        </Grid2>
        <Grid2>
          <Field>
            <FieldLabel>Mot de passe initial (≥ 12 caractères)</FieldLabel>
            <Input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel>Rôle</FieldLabel>
            <select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as InvitedUser['role'] })}
              style={{ height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)' }}
            >
              <option value="SECRETAIRE">Secrétaire</option>
              <option value="ASSISTANT">Assistant(e)</option>
              <option value="MEDECIN">Médecin</option>
              <option value="ADMIN">Administrateur</option>
            </select>
          </Field>
        </Grid2>
        <Button onClick={onAdd} disabled={isPending}>
          + Ajouter ce membre
        </Button>
      </Panel>

      {invited.length > 0 && (
        <Panel className="ob-form-panel" style={{ marginTop: 16 }}>
          <h3 className="ob-section-title">Déjà ajoutés ({invited.length})</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {invited.map((u, i) => (
              <li key={i} style={{ fontSize: 12.5, padding: '6px 10px', background: 'var(--bg-alt)', borderRadius: 6 }}>
                {u.firstName} {u.lastName} · {u.email} · <strong>{u.role}</strong>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}

function TarifsStep({
  premiumDiscount,
  setPremiumDiscount,
  acts,
}: {
  premiumDiscount: number;
  setPremiumDiscount: (n: number) => void;
  acts: ActMeta[];
}) {
  const activeActs = acts.filter((a) => a.active);
  return (
    <>
      <h1 className="ob-title">Vos tarifs et actes médicaux</h1>
      <p className="ob-sub">
        Voici la nomenclature des actes facturables avec leur éligibilité par assurance.
        L’édition fine se fait depuis Paramétrage › Catalogue. La remise Premium ci-dessous
        s’applique automatiquement aux factures patients Premium.
      </p>

      <Panel className="ob-form-panel" style={{ padding: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '90px 1.6fr 96px 56px 56px 56px',
            padding: '11px 16px',
            fontSize: 11,
            color: 'var(--ink-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontWeight: 600,
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>Code</span>
          <span>Acte</span>
          <span style={{ textAlign: 'right' }}>Prix MAD</span>
          <span style={{ textAlign: 'center' }}>CNOPS</span>
          <span style={{ textAlign: 'center' }}>CNSS</span>
          <span style={{ textAlign: 'center' }}>RAMED</span>
        </div>
        {activeActs.length === 0 && (
          <div style={{ padding: '24px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>
            Aucun acte configuré.
          </div>
        )}
        {activeActs.map((a, i) => {
          const price = a.defaultPrice != null ? Number(a.defaultPrice) : null;
          return (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 1.6fr 96px 56px 56px 56px',
                alignItems: 'center',
                padding: '11px 16px',
                borderBottom:
                  i < activeActs.length - 1 ? '1px solid var(--border-soft)' : 'none',
                gap: 8,
              }}
            >
              <span
                className="tnum"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--ink-3)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {a.code ?? '—'}
              </span>
              <span style={{ fontSize: 13, color: 'var(--ink)' }}>{a.name}</span>
              <span
                className="tnum"
                style={{ fontSize: 13, fontWeight: 600, textAlign: 'right' }}
              >
                {price != null ? price.toLocaleString('fr-FR') : '—'}
                <span style={{ color: 'var(--ink-3)', fontSize: 11, fontWeight: 500, marginLeft: 3 }}>
                  DH
                </span>
              </span>
              <Mark on={a.cnopsEligible} />
              <Mark on={a.cnssEligible} />
              <Mark on={a.ramedEligible} />
            </div>
          );
        })}
      </Panel>

      <Panel className="ob-form-panel" style={{ marginTop: 16 }}>
        <Field>
          <FieldLabel>Remise patient Premium (%)</FieldLabel>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={premiumDiscount}
            onChange={(e) => setPremiumDiscount(Number(e.target.value) || 0)}
          />
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
            La remise s’applique automatiquement à toute facture issue d’une consultation patient Premium.
            L’aperçu à droite reflète le calcul en temps réel.
          </div>
        </Field>
      </Panel>
    </>
  );
}

function Mark({ on }: { on: boolean }) {
  if (on) {
    return (
      <span
        style={{
          display: 'inline-grid',
          placeItems: 'center',
          width: 18,
          height: 18,
          borderRadius: 4,
          background: '#DEF0E6',
          color: '#2F8F6B',
          justifySelf: 'center',
        }}
        aria-label="Éligible"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  return (
    <span
      style={{
        display: 'inline-block',
        width: 18,
        height: 18,
        borderRadius: 4,
        background: 'var(--bg)',
        color: 'var(--ink-4)',
        textAlign: 'center',
        lineHeight: '18px',
        fontSize: 11,
        justifySelf: 'center',
      }}
      aria-label="Non éligible"
    >
      —
    </span>
  );
}

function DocumentsStep({
  templates,
}: {
  templates: { id: string; type: string; pageFormat: string; templateBytes: number; updatedAt: string }[];
}) {
  return (
    <>
      <h1 className="ob-title">Vos documents officiels</h1>
      <p className="ob-sub">
        Vos modèles de documents sont préconfigurés avec l’en-tête de votre cabinet (nom, adresse, mentions
        légales). L’édition fine du contenu se fait depuis Paramétrage › Documents.
      </p>
      <Panel className="ob-form-panel" style={{ padding: 0 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1.4fr 60px 1fr 24px',
          padding: '11px 16px', fontSize: 11, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600,
          background: 'var(--surface-2)', borderBottom: '1px solid var(--border)',
        }}>
          <span>Type de document</span>
          <span>Format</span>
          <span>Statut</span>
          <span />
        </div>
        {templates.length === 0 && (
          <div style={{ padding: '20px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>
            Aucun modèle configuré pour l’instant.
          </div>
        )}
        {templates.map((t, i) => (
          <div
            key={t.id}
            style={{
              display: 'grid', gridTemplateColumns: '1.4fr 60px 1fr 24px',
              padding: '12px 16px', alignItems: 'center',
              borderBottom: i < templates.length - 1 ? '1px solid var(--border-soft)' : 'none',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 500 }}>
              {TEMPLATE_TYPE_LABELS[t.type] ?? t.type}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t.pageFormat}</span>
            <span style={{ fontSize: 12, color: 'var(--ok, #2F8F6B)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Check /> Modèle par défaut chargé
            </span>
            <span />
          </div>
        ))}
      </Panel>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 14, lineHeight: 1.5 }}>
        Ces modèles utilisent l’identité de votre cabinet (étape 1) et votre signature (étape 2).
        Aucune action requise pour démarrer.
      </p>
    </>
  );
}

function RecapStep({
  clinicName,
  city,
  invitedCount,
  specialty,
  hasSignature,
  templateCount,
  activeDays,
}: {
  clinicName: string;
  city: string;
  invitedCount: number;
  specialty: string;
  hasSignature: boolean;
  templateCount: number;
  activeDays: number;
}) {
  return (
    <>
      <h1 className="ob-title">Bienvenue sur careplus</h1>
      <p className="ob-sub">
        {clinicName ? `${clinicName}${city ? ` (${city})` : ''} ` : 'Votre cabinet '}
        est configuré. Vos données sont chiffrées et synchronisées sur les serveurs marocains.
        Vous pouvez maintenant recevoir vos premiers patients.
      </p>
      <Panel className="ob-form-panel">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>✅ Identité et mentions légales du cabinet</li>
          <li>
            {specialty
              ? `✅ Profil médecin (${specialty})`
              : '⚠️ Spécialité non renseignée (à compléter depuis Profil)'}
          </li>
          <li>{hasSignature ? '✅ Signature scannée téléversée' : '⚠️ Signature non téléversée'}</li>
          <li>{activeDays > 0 ? `✅ Horaires d’ouverture sur ${activeDays} jour${activeDays > 1 ? 's' : ''}` : '⚠️ Aucun jour ouvert configuré'}</li>
          <li>{invitedCount > 0 ? `✅ ${invitedCount} membre${invitedCount > 1 ? 's' : ''} ajouté${invitedCount > 1 ? 's' : ''}` : '⚠️ Aucun membre ajouté (à compléter dans Paramétrage)'}</li>
          <li>✅ Remise Premium configurée</li>
          <li>{templateCount > 0 ? `✅ ${templateCount} modèles de documents prêts` : '⚠️ Aucun modèle de document configuré'}</li>
        </ul>
      </Panel>
    </>
  );
}

function Grid2({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {children}
    </div>
  );
}
