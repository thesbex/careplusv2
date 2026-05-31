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
import { Input, Select } from '@/components/ui/Input';
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
  useOnboardingState,
  useUpdateOnboardingStep,
  useCompleteOnboarding,
  useClinicLogoMeta,
  useUploadClinicLogo,
  TEMPLATE_TYPE_LABELS,
  type ActMeta,
  type WorkingHoursDay,
  type WorkingHoursView,
  type PractitionerCredentialsForm,
} from './hooks/useOnboardingApi';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
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

const STEPS: { key: StepKey; labelKey: string }[] = [
  { key: 'cabinet', labelKey: 'onboarding.step.cabinet' },
  { key: 'medecin', labelKey: 'onboarding.step.medecin' },
  { key: 'horaires', labelKey: 'onboarding.step.horaires' },
  { key: 'equipe', labelKey: 'onboarding.step.equipe' },
  { key: 'tarifs', labelKey: 'onboarding.step.tarifs' },
  { key: 'documents', labelKey: 'onboarding.step.documents' },
  { key: 'recap', labelKey: 'onboarding.step.recap' },
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
  rc: '',
  ifNo: '',
  legalForm: '',
  establishmentType: 'CABINET',
};

const ESTABLISHMENT_OPTIONS: { value: 'CABINET' | 'CLINIQUE' | 'CENTRE_MEDICAL'; labelKey: string; subKey: string }[] = [
  { value: 'CABINET', labelKey: 'onboarding.estab.cabinet.label', subKey: 'onboarding.estab.cabinet.sub' },
  { value: 'CLINIQUE', labelKey: 'onboarding.estab.clinique.label', subKey: 'onboarding.estab.clinique.sub' },
  { value: 'CENTRE_MEDICAL', labelKey: 'onboarding.estab.centre.label', subKey: 'onboarding.estab.centre.sub' },
];

// La valeur stockée reste la chaîne FR (compat backend) ; on traduit seulement le libellé affiché.
const LEGAL_FORM_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'Profession libérale (individuelle)', labelKey: 'onboarding.legalForm.liberal' },
  { value: 'SCM — Société civile de moyens', labelKey: 'onboarding.legalForm.scm' },
  { value: 'SCP — Société civile professionnelle', labelKey: 'onboarding.legalForm.scp' },
  { value: 'SARL médicale', labelKey: 'onboarding.legalForm.sarl' },
];

interface InvitedUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'SECRETAIRE' | 'ASSISTANT' | 'MEDECIN' | 'ADMIN';
}

const HOUR_TEMPLATES: { key: string; labelKey: string; subKey: string; week: WorkingHoursView }[] = [
  {
    key: 'classique',
    labelKey: 'onboarding.horaires.tpl.classique',
    subKey: 'onboarding.horaires.tpl.classiqueSub',
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
    labelKey: 'onboarding.horaires.tpl.continue',
    subKey: 'onboarding.horaires.tpl.continueSub',
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
    labelKey: 'onboarding.horaires.tpl.matinees',
    subKey: 'onboarding.horaires.tpl.matineesSub',
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
  const { t } = useT();
  const navigate = useNavigate();
  const sessionUser = useAuthStore((s) => s.user);
  const { state: onboardingState } = useOnboardingState();
  const { updateStep: persistStep } = useUpdateOnboardingStep();
  const { complete: completeOnboarding } = useCompleteOnboarding();
  const [stepIdx, setStepIdx] = useState(0);
  // Resume the wizard at the step where the user last left off. Runs once on
  // mount when the BE state arrives — keyed on currentStep so a re-fetch later
  // doesn't reset the position the user has since navigated to.
  const resumedRef = useState({ done: false })[0];
  useEffect(() => {
    if (resumedRef.done) return;
    if (onboardingState.currentStep) {
      const idx = STEPS.findIndex((s) => s.key === onboardingState.currentStep);
      if (idx >= 0) {
        setStepIdx(idx);
        resumedRef.done = true;
      }
    } else if (onboardingState.completed === false && onboardingState.currentStep === null) {
      // First visit — defaults to step 0, mark resumed.
      resumedRef.done = true;
    }
  }, [onboardingState.currentStep, onboardingState.completed, resumedRef]);

  const step = STEPS[stepIdx]!;

  /** PUT the current step to the BE after a successful save / skip. */
  function advanceTo(nextIdx: number) {
    setStepIdx(nextIdx);
    const next = STEPS[nextIdx];
    if (next) void persistStep(next.key).catch(() => undefined);
  }

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
        rc: settings.rc ?? '',
        ifNo: settings.ifNo ?? '',
        legalForm: settings.legalForm ?? '',
        establishmentType: settings.establishmentType ?? 'CABINET',
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
  const { logoMeta } = useClinicLogoMeta(settings?.hasLogo ?? false);
  const { upload: uploadLogo, isPending: isUploadingLogo } = useUploadClinicLogo();
  const [activeDocTab, setActiveDocTab] = useState<'ORDONNANCE' | 'FACTURE' | 'CERTIFICAT' | 'CR'>(
    'ORDONNANCE',
  );

  async function handleLogoFile(file: File) {
    try {
      await uploadLogo(file);
      toast.success(t('onboarding.toast.logoUploaded'));
    } catch (err) {
      const p = toProblemDetail(err);
      toast.error(p.title, p.detail ? { description: p.detail } : undefined);
    }
  }

  function setClinicField<K extends keyof ClinicSettingsForm>(k: K, v: ClinicSettingsForm[K]) {
    setClinic((c) => ({ ...c, [k]: v }));
  }

  async function handleNext() {
    if (step.key === 'cabinet') {
      if (!clinic.name || !clinic.address || !clinic.city || !clinic.phone) {
        toast.error(t('onboarding.toast.requiredCabinet'));
        return;
      }
      try {
        await updateClinic(clinic);
        toast.success(t('onboarding.toast.cabinetSaved'));
        advanceTo(stepIdx + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'medecin') {
      if (!sessionUser?.id) {
        toast.error(t('onboarding.toast.invalidSession'));
        return;
      }
      try {
        await updateCredentials({ userId: sessionUser.id, form: credentials });
        toast.success(t('onboarding.toast.medecinSaved'));
        advanceTo(stepIdx + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'horaires') {
      try {
        await updateWorkingHours(hours);
        toast.success(t('onboarding.toast.hoursSaved'));
        advanceTo(stepIdx + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'equipe') {
      advanceTo(stepIdx + 1);
    } else if (step.key === 'tarifs') {
      try {
        await updateTier({ tier: 'PREMIUM', discountPercent: premiumDiscount });
        toast.success(t('onboarding.toast.tarifsSaved'));
        advanceTo(stepIdx + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'documents') {
      // Read-only step — just advance.
      advanceTo(stepIdx + 1);
    } else if (step.key === 'recap') {
      try {
        await completeOnboarding();
      } catch {
        // Don't block — gate refresh on the next route already handles it.
      }
      navigate('/agenda');
    }
  }

  async function handleAddInvited() {
    if (!draft.email || draft.password.length < 12 || !draft.firstName || !draft.lastName) {
      toast.error(t('onboarding.toast.memberRequired'));
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
      toast.success(t('onboarding.toast.memberAdded'));
    } catch (err) {
      const p = toProblemDetail(err);
      toast.error(p.title, p.detail ? { description: p.detail } : undefined);
    }
  }

  async function handleSignatureFile(file: File) {
    if (!sessionUser?.id) return;
    try {
      await uploadSignature({ userId: sessionUser.id, file });
      toast.success(t('onboarding.toast.signatureUploaded'));
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
  const nextLabel = stepIdx < STEPS.length - 1 ? t(STEPS[stepIdx + 1]!.labelKey) : null;

  return (
    <div className="ob-root">
      <header className="ob-topbar">
        <BrandMark size="sm" />
        <span className="ob-topbar-name">
          <BrandWordmark />
        </span>
        <Pill style={{ marginLeft: 10 }}>{t('onboarding.topbar.pill')}</Pill>
        <span className="ob-topbar-session">{t('onboarding.topbar.session', { name: sessionLabel })}</span>
        <button
          type="button"
          className="ob-topbar-logout"
          onClick={() => void handleLogout()}
          aria-label={t('onboarding.topbar.logout')}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          {t('onboarding.topbar.logout')}
        </button>
      </header>

      <nav className="ob-rail" aria-label={t('onboarding.steps.aria')}>
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
                  <span className="ob-step-label">{t(s.labelKey)}</span>
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
            <div className="ob-eyebrow">{t('onboarding.eyebrow', { n: stepIdx + 1, total: STEPS.length })}</div>

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
              <DocumentsStep
                templates={templates}
                clinic={clinic}
                practitionerSpecialty={credentials.specialty}
                practitionerInpe={credentials.inpe}
                practitionerCnom={credentials.cnom}
                hasLogo={settings?.hasLogo ?? false}
                hasSignature={!!signatureMeta}
                logoUploadedAt={logoMeta?.uploadedAt ?? null}
                onLogoFile={(f) => void handleLogoFile(f)}
                isUploadingLogo={isUploadingLogo}
                activeTab={activeDocTab}
                onTabChange={setActiveDocTab}
              />
            )}

            {step.key === 'recap' && (
              <RecapStep
                clinic={clinic}
                practitionerFullName={
                  sessionUser ? `Dr. ${sessionUser.firstName} ${sessionUser.lastName}` : t('onboarding.recap.mainPractitioner')
                }
                credentials={credentials}
                hasSignature={!!signatureMeta}
                invitedCount={invited.length}
                doctorCount={doctors.length}
                activeDays={hours.days.filter((d) => d.active).length}
                actCount={acts.filter((a) => a.active).length}
                templateCount={templates.length}
                onGoToStep={(idx) => advanceTo(idx)}
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
          onClick={() => advanceTo(Math.max(0, stepIdx - 1))}
          disabled={stepIdx === 0 || isPending}
        >
          <ChevronLeft /> {t('onboarding.nav.prev')}
        </Button>
        <div className="ob-footer-right">
          {step.key !== 'recap' && (
            <Button variant="ghost" onClick={() => advanceTo(stepIdx + 1)} disabled={isPending}>
              {t('onboarding.nav.skip')}
            </Button>
          )}
          <Button
            variant="primary"
            size="lg"
            onClick={() => void handleNext()}
            disabled={isPending}
          >
            {step.key === 'recap'
              ? t('onboarding.nav.open')
              : isPending
                ? t('onboarding.nav.saving')
                : nextLabel
                  ? t('onboarding.nav.continueTo', { next: nextLabel })
                  : t('onboarding.nav.continue')}
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
  const { t } = useT();
  return (
    <>
      <h1 className="ob-title">{t('onboarding.cabinet.title')}</h1>
      <p className="ob-sub">{t('onboarding.cabinet.sub')}</p>

      {/* Type de cabinet — 3-card selector wired to V034 establishment_type */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10 }}>
          {t('onboarding.cabinet.typeLabel')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {ESTABLISHMENT_OPTIONS.map((opt) => {
            const selected = (clinic.establishmentType ?? 'CABINET') === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setField('establishmentType', opt.value)}
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 4,
                  padding: '14px',
                  background: selected ? 'var(--primary-soft)' : 'var(--surface)',
                  border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  display: 'flex',
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: selected ? 'var(--primary)' : 'var(--ink)',
                  }}
                >
                  {t(opt.labelKey)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontWeight: 400, lineHeight: 1.4 }}>
                  {t(opt.subKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Identité */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 10 }}>
        {t('onboarding.cabinet.identityLabel')}
      </div>
      <Panel className="ob-form-panel">
        <Field>
          <FieldLabel>{t('onboarding.cabinet.name')}</FieldLabel>
          <Input
            value={clinic.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder={t('onboarding.cabinet.namePlaceholder')}
          />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.legalForm')}</FieldLabel>
            <Select
              value={clinic.legalForm ?? ''}
              onChange={(e) => setField('legalForm', e.target.value)}
              style={{
                height: 36,
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: 'var(--surface)',
                width: '100%',
              }}
            >
              <option value="">{t('onboarding.cabinet.selectPlaceholder')}</option>
              {LEGAL_FORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.phone')}</FieldLabel>
            <Input
              value={clinic.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="+212 5 22 47 85 20"
            />
          </Field>
        </div>
        <Grid2>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.email')}</FieldLabel>
            <Input
              value={clinic.email}
              onChange={(e) => setField('email', e.target.value)}
              placeholder="contact@cabinet.ma"
            />
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.city')}</FieldLabel>
            <Input
              value={clinic.city}
              onChange={(e) => setField('city', e.target.value)}
              placeholder="Casablanca"
            />
          </Field>
        </Grid2>
        <Field>
          <FieldLabel>{t('onboarding.cabinet.address')}</FieldLabel>
          <Input
            value={clinic.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="24, Rue Tahar Sebti — Quartier Gauthier"
          />
        </Field>
      </Panel>

      {/* Mentions légales */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', margin: '22px 0 10px' }}>
        {t('onboarding.cabinet.legalMentions')}
      </div>
      <Panel className="ob-form-panel">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.ice')}</FieldLabel>
            <Input
              value={clinic.ice}
              onChange={(e) => setField('ice', e.target.value)}
              placeholder="002 547 810 000 093"
            />
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.rc')}</FieldLabel>
            <Input
              value={clinic.rc ?? ''}
              onChange={(e) => setField('rc', e.target.value)}
              placeholder="547821 — Casablanca"
            />
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.if')}</FieldLabel>
            <Input
              value={clinic.ifNo ?? ''}
              onChange={(e) => setField('ifNo', e.target.value)}
              placeholder="14 785 236"
            />
          </Field>
        </div>
        <Grid2>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.inpe')}</FieldLabel>
            <Input
              value={clinic.inpe}
              onChange={(e) => setField('inpe', e.target.value)}
              placeholder="12 / 458 / 21"
            />
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.cabinet.rib')}</FieldLabel>
            <Input
              value={clinic.rib}
              onChange={(e) => setField('rib', e.target.value)}
              placeholder="..."
            />
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
  const { t } = useT();
  return (
    <>
      <h1 className="ob-title">{t('onboarding.medecin.title')}</h1>
      <p className="ob-sub">{t('onboarding.medecin.sub')}</p>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
          {t('onboarding.medecin.countLabel', { n: doctors.length })}
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
                      {t('onboarding.medecin.you')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
                  {isMe ? t('onboarding.medecin.adminPrincipal') : t('onboarding.medecin.associate')} · {d.email}
                </div>
              </div>
            </div>

            {isMe ? (
              <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Grid2>
                  <Field>
                    <FieldLabel>{t('onboarding.medecin.specialty')}</FieldLabel>
                    <Input
                      value={credentials.specialty}
                      onChange={(e) =>
                        setCredentials({ ...credentials, specialty: e.target.value })
                      }
                      placeholder={t('onboarding.medecin.specialtyPlaceholder')}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t('onboarding.medecin.inpe')}</FieldLabel>
                    <Input
                      value={credentials.inpe}
                      onChange={(e) => setCredentials({ ...credentials, inpe: e.target.value })}
                      placeholder="12 / 458 / 21"
                    />
                  </Field>
                </Grid2>
                <Grid2>
                  <Field>
                    <FieldLabel>{t('onboarding.medecin.cnom')}</FieldLabel>
                    <Input
                      value={credentials.cnom}
                      onChange={(e) => setCredentials({ ...credentials, cnom: e.target.value })}
                      placeholder="CNOM-7841-CASA"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>{t('onboarding.medecin.cnops')}</FieldLabel>
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
                <DoctorField label={t('onboarding.medecin.specialty')} value={d.specialty} />
                <DoctorField label={t('onboarding.medecin.inpe')} value={d.inpe} mono />
                <DoctorField label={t('onboarding.medecin.cnom')} value={d.cnom} mono />
                <DoctorField label={t('onboarding.medecin.cnops')} value={d.cnops} mono />
                <DoctorField
                  label={t('onboarding.medecin.signature')}
                  value={d.hasSignature ? t('onboarding.medecin.signatureUploaded') : t('onboarding.medecin.signatureTodo')}
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
          {t('onboarding.medecin.addAssociate')}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          {t('onboarding.medecin.addAssociateHint')}
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
  const { t } = useT();
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
        {t('onboarding.medecin.signature')}
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
          ? t('onboarding.sig.uploading')
          : hasSignature
            ? t('onboarding.sig.replace')
            : t('onboarding.sig.upload')}
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
          <Check /> {t('onboarding.sig.saved')}
        </span>
      )}
    </div>
  );
}

function HorairesStep({
  hours,
  setHours,
}: {
  hours: WorkingHoursView;
  setHours: (h: WorkingHoursView) => void;
}) {
  const { t } = useT();
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
      <h1 className="ob-title">{t('onboarding.horaires.title')}</h1>
      <p className="ob-sub">{t('onboarding.horaires.sub')}</p>

      <div className="ob-section">
        <div className="ob-section-label">{t('onboarding.horaires.fromTemplate')}</div>
        <div className="ob-templates">
          {HOUR_TEMPLATES.map((m) => (
            <button
              key={m.key}
              type="button"
              className="ob-template"
              onClick={() => applyTemplate(m.key)}
            >
              <span className="ob-template-t">{t(m.labelKey)}</span>
              <span className="ob-template-sub">{t(m.subKey)}</span>
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
              <span className="ob-hours-day">{t(`onboarding.day.${d.dayOfWeek}`)}</span>
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
                {d.active ? t('onboarding.horaires.open') : t('onboarding.horaires.closed')}
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
                        {t('onboarding.horaires.addAfternoon')}
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
          <input type="checkbox" defaultChecked /> {t('onboarding.horaires.opt.lunch')}
        </label>
        <label>
          <input type="checkbox" /> {t('onboarding.horaires.opt.urgency')}
        </label>
        <label>
          <input type="checkbox" defaultChecked /> {t('onboarding.horaires.opt.holidays')}
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
  const { t } = useT();
  return (
    <>
      <h1 className="ob-title">{t('onboarding.equipe.title')}</h1>
      <p className="ob-sub">{t('onboarding.equipe.sub')}</p>
      <Panel className="ob-form-panel">
        <Grid2>
          <Field>
            <FieldLabel>{t('onboarding.equipe.firstName')}</FieldLabel>
            <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.equipe.lastName')}</FieldLabel>
            <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
          </Field>
        </Grid2>
        <Grid2>
          <Field>
            <FieldLabel>{t('onboarding.equipe.email')}</FieldLabel>
            <Input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.equipe.phone')}</FieldLabel>
            <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </Field>
        </Grid2>
        <Grid2>
          <Field>
            <FieldLabel>{t('onboarding.equipe.password')}</FieldLabel>
            <Input type="password" value={draft.password} onChange={(e) => setDraft({ ...draft, password: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel>{t('onboarding.equipe.role')}</FieldLabel>
            <Select
              value={draft.role}
              onChange={(e) => setDraft({ ...draft, role: e.target.value as InvitedUser['role'] })}
              style={{ height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)' }}
            >
              <option value="SECRETAIRE">{t('onboarding.equipe.role.secretaire')}</option>
              <option value="ASSISTANT">{t('onboarding.equipe.role.assistant')}</option>
              <option value="MEDECIN">{t('onboarding.equipe.role.medecin')}</option>
              <option value="ADMIN">{t('onboarding.equipe.role.admin')}</option>
            </Select>
          </Field>
        </Grid2>
        <Button onClick={onAdd} disabled={isPending}>
          {t('onboarding.equipe.add')}
        </Button>
      </Panel>

      {invited.length > 0 && (
        <Panel className="ob-form-panel" style={{ marginTop: 16 }}>
          <h3 className="ob-section-title">{t('onboarding.equipe.alreadyAdded', { n: invited.length })}</h3>
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
  const { t } = useT();
  const activeActs = acts.filter((a) => a.active);
  return (
    <>
      <h1 className="ob-title">{t('onboarding.tarifs.title')}</h1>
      <p className="ob-sub">{t('onboarding.tarifs.sub')}</p>

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
          <span>{t('onboarding.tarifs.col.code')}</span>
          <span>{t('onboarding.tarifs.col.acte')}</span>
          <span style={{ textAlign: 'right' }}>{t('onboarding.tarifs.col.price')}</span>
          <span style={{ textAlign: 'center' }}>CNOPS</span>
          <span style={{ textAlign: 'center' }}>CNSS</span>
          <span style={{ textAlign: 'center' }}>RAMED</span>
        </div>
        {activeActs.length === 0 && (
          <div style={{ padding: '24px 16px', fontSize: 12.5, color: 'var(--ink-3)' }}>
            {t('onboarding.tarifs.empty')}
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
          <FieldLabel>{t('onboarding.tarifs.premiumDiscount')}</FieldLabel>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={premiumDiscount}
            onChange={(e) => setPremiumDiscount(Number(e.target.value) || 0)}
          />
          <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 6 }}>
            {t('onboarding.tarifs.premiumHint')}
          </div>
        </Field>
      </Panel>
    </>
  );
}

function Mark({ on }: { on: boolean }) {
  const { t } = useT();
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
        aria-label={t('onboarding.tarifs.eligible')}
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
      aria-label={t('onboarding.tarifs.notEligible')}
    >
      —
    </span>
  );
}

function DocumentsStep({
  templates,
  clinic,
  practitionerSpecialty,
  practitionerInpe,
  practitionerCnom,
  hasLogo,
  hasSignature,
  logoUploadedAt,
  onLogoFile,
  isUploadingLogo,
  activeTab,
  onTabChange,
}: {
  templates: { id: string; type: string; pageFormat: string; templateBytes: number; updatedAt: string }[];
  clinic: ClinicSettingsForm;
  practitionerSpecialty: string;
  practitionerInpe: string;
  practitionerCnom: string;
  hasLogo: boolean;
  hasSignature: boolean;
  logoUploadedAt: string | null;
  onLogoFile: (file: File) => void;
  isUploadingLogo: boolean;
  activeTab: 'ORDONNANCE' | 'FACTURE' | 'CERTIFICAT' | 'CR';
  onTabChange: (t: 'ORDONNANCE' | 'FACTURE' | 'CERTIFICAT' | 'CR') => void;
}) {
  const { t } = useT();
  const tabs: { key: 'ORDONNANCE' | 'FACTURE' | 'CERTIFICAT' | 'CR'; label: string }[] = [
    { key: 'ORDONNANCE', label: t('onboarding.documents.tab.ordonnance') },
    { key: 'FACTURE', label: t('onboarding.documents.tab.facture') },
    { key: 'CERTIFICAT', label: t('onboarding.documents.tab.certificat') },
    { key: 'CR', label: t('onboarding.documents.tab.cr') },
  ];

  const footerMentions = [
    clinic.ice && `ICE ${clinic.ice}`,
    clinic.rc && `RC ${clinic.rc}`,
    clinic.ifNo && `IF ${clinic.ifNo}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <h1 className="ob-title">{t('onboarding.documents.title')}</h1>
      <p className="ob-sub">{t('onboarding.documents.sub')}</p>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 18,
          padding: 4,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          width: 'fit-content',
        }}
        role="tablist"
        aria-label={t('onboarding.documents.tabsAria')}
      >
        {tabs.map((t) => {
          const on = t.key === activeTab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onTabChange(t.key)}
              style={{
                height: 30,
                padding: '0 14px',
                fontSize: 12,
                fontWeight: on ? 600 : 500,
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: on ? 'var(--surface)' : 'transparent',
                color: on ? 'var(--ink)' : 'var(--ink-3)',
                boxShadow: on ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                fontFamily: 'inherit',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Logo */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
          {t('onboarding.documents.logoLabel')}
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <label
            htmlFor="onboarding-logo-input"
            style={{
              width: 88,
              height: 88,
              border: '1.5px dashed var(--border-strong)',
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              background: hasLogo ? '#fff' : 'var(--surface)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
            aria-label={t('onboarding.documents.logoUploadAria')}
          >
            {hasLogo ? (
              <img
                key={logoUploadedAt ?? 'logo'}
                src={`/api/settings/clinic/logo?t=${encodeURIComponent(logoUploadedAt ?? '')}`}
                alt={t('onboarding.documents.logoAlt')}
                style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--primary)' }} aria-hidden="true">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: 10.5, fontWeight: 500, marginTop: 2 }}>PNG / JPEG</div>
              </div>
            )}
          </label>
          <input
            id="onboarding-logo-input"
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onLogoFile(f);
            }}
            style={{ display: 'none' }}
          />
          <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>
            {isUploadingLogo ? (
              <span style={{ color: 'var(--primary)' }}>{t('onboarding.documents.logoUploading')}</span>
            ) : hasLogo ? (
              <>
                <span style={{ color: '#2F8F6B', fontWeight: 600 }}>{t('onboarding.documents.logoSaved')}</span>{' '}
                {t('onboarding.documents.logoSavedHint')}
                <br />
                {t('onboarding.documents.logoReco')}
              </>
            ) : (
              <>
                {t('onboarding.documents.logoBrowsePre')}{' '}
                <span style={{ color: 'var(--primary)', fontWeight: 500 }}>{t('onboarding.documents.logoBrowse')}</span>
                <br />
                {t('onboarding.documents.logoRecoMin')}
                <br />
                <span style={{ color: 'var(--ink-4)' }}>
                  {t('onboarding.documents.logoOnHeader')}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* En-tête */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
        {t('onboarding.documents.header')}
      </div>
      <Panel className="ob-form-panel" style={{ marginBottom: 18 }}>
        <Grid2>
          <ReadField label={t('onboarding.documents.headerCabinetName')} value={clinic.name} />
          <ReadField label={t('onboarding.documents.headerSpecialty')} value={practitionerSpecialty} />
        </Grid2>
        <Grid2>
          <ReadField label={t('onboarding.documents.headerAddress')} value={clinic.address} />
          <ReadField label={t('onboarding.documents.headerPhone')} value={clinic.phone} mono />
        </Grid2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <ReadField label={t('onboarding.documents.headerInpe')} value={practitionerInpe} mono />
          <ReadField label={t('onboarding.documents.headerCnom')} value={practitionerCnom} mono />
          <ReadField label={t('onboarding.documents.headerIce')} value={clinic.ice} mono />
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--ink-3)',
            background: 'var(--surface-2)',
            padding: '8px 10px',
            borderRadius: 4,
            lineHeight: 1.5,
          }}
        >
          {t('onboarding.documents.headerNote')}
        </div>
      </Panel>

      {/* Signature et cachet */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
        {t('onboarding.documents.sigStamp')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
        <Panel style={{ padding: 14, textAlign: 'center' }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {t('onboarding.documents.signature')}
          </div>
          <div
            style={{
              height: 70,
              border: '1px dashed var(--border-strong)',
              borderRadius: 4,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              color: hasSignature ? '#2F8F6B' : 'var(--ink-3)',
              background: 'var(--surface)',
            }}
          >
            {hasSignature ? t('onboarding.documents.signatureSaved') : t('onboarding.documents.signatureTodo')}
          </div>
        </Panel>
        <Panel style={{ padding: 14, textAlign: 'center', opacity: 0.6 }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 600,
              marginBottom: 8,
            }}
          >
            {t('onboarding.documents.stamp')}
          </div>
          <div
            style={{
              height: 70,
              border: '1px dashed var(--border-strong)',
              borderRadius: 4,
              display: 'grid',
              placeItems: 'center',
              background: 'var(--surface)',
              fontSize: 11,
              color: 'var(--ink-3)',
            }}
          >
            {t('onboarding.documents.stampSoon')}
          </div>
        </Panel>
      </div>

      {/* Pied de page — auto-computed */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 8 }}>
        {t('onboarding.documents.footer')}
      </div>
      <Panel className="ob-form-panel" style={{ marginBottom: 14 }}>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ink-2)',
            background: 'var(--surface-2)',
            padding: 10,
            borderRadius: 4,
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
          }}
        >
          {clinic.name ? `${clinic.name} · ` : ''}
          {footerMentions || t('onboarding.documents.footerEmpty')}
        </div>
      </Panel>

      {/* 3 options — visual */}
      <div style={{ display: 'flex', gap: 18, fontSize: 12.5, color: 'var(--ink-2)', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: 0.7 }}>
          <input type="checkbox" defaultChecked disabled /> {t('onboarding.documents.opt.watermark')}
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: 0.7 }}>
          <input type="checkbox" defaultChecked disabled /> {t('onboarding.documents.opt.qr')}
        </label>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: 0.7 }}>
          <input type="checkbox" disabled /> {t('onboarding.documents.opt.bilingual')}
        </label>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 4 }}>
        {t('onboarding.documents.optNote')}
      </div>

      {/* Templates inventory — concise */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)', margin: '22px 0 8px' }}>
        {t('onboarding.documents.templates', { n: templates.length })}
      </div>
      <Panel className="ob-form-panel" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {templates.map((t) => (
            <span
              key={t.id}
              style={{
                fontSize: 11.5,
                padding: '4px 10px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--ink-2)',
              }}
            >
              {TEMPLATE_TYPE_LABELS[t.type] ?? t.type} · {t.pageFormat}
            </span>
          ))}
        </div>
      </Panel>
    </>
  );
}

function ReadField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  const empty = !value;
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-3)',
          fontWeight: 500,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        className={mono ? 'tnum' : ''}
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: empty ? 'var(--ink-3)' : 'var(--ink)',
          padding: '8px 10px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border-soft)',
          borderRadius: 4,
          minHeight: 18,
        }}
      >
        {value || '—'}
      </div>
    </div>
  );
}

function RecapStep({
  clinic,
  practitionerFullName,
  credentials,
  hasSignature,
  invitedCount,
  doctorCount,
  activeDays,
  actCount,
  templateCount,
  onGoToStep,
}: {
  clinic: ClinicSettingsForm;
  practitionerFullName: string;
  credentials: PractitionerCredentialsForm;
  hasSignature: boolean;
  invitedCount: number;
  doctorCount: number;
  activeDays: number;
  actCount: number;
  templateCount: number;
  onGoToStep: (idx: number) => void;
}) {
  const { t } = useT();
  const checks = [
    {
      stepIdx: 0,
      title: t('onboarding.recap.check.cabinet'),
      desc:
        clinic.name
          ? `${clinic.name}${clinic.city ? ` · ${clinic.city}` : ''}${
              clinic.ice ? ` · ICE ${clinic.ice}` : ''
            }`
          : t('onboarding.recap.check.cabinetEmpty'),
      ok: !!clinic.name && !!clinic.city,
    },
    {
      stepIdx: 1,
      title: t('onboarding.recap.check.medecin'),
      desc:
        credentials.specialty || credentials.inpe
          ? `${practitionerFullName}${credentials.specialty ? ` · ${credentials.specialty}` : ''}${
              credentials.inpe ? ` · INPE ${credentials.inpe}` : ''
            }${hasSignature ? ' · signature ✓' : ''}`
          : t('onboarding.recap.check.medecinEmpty'),
      ok: !!credentials.specialty || !!credentials.inpe,
    },
    {
      stepIdx: 2,
      title: t('onboarding.recap.check.horaires'),
      desc:
        activeDays > 0
          ? `${activeDays} jour${activeDays > 1 ? 's' : ''} d'ouverture configuré${activeDays > 1 ? 's' : ''}`
          : t('onboarding.recap.check.horairesNone'),
      ok: activeDays > 0,
    },
    {
      stepIdx: 3,
      title: t('onboarding.recap.check.equipe'),
      desc:
        doctorCount + invitedCount > 1
          ? `${doctorCount} médecin${doctorCount > 1 ? 's' : ''}${
              invitedCount > 0
                ? ` · ${invitedCount} invitation${invitedCount > 1 ? 's' : ''} en attente`
                : ''
            }`
          : t('onboarding.recap.check.equipeSolo'),
      ok: doctorCount > 0,
    },
    {
      stepIdx: 4,
      title: t('onboarding.recap.check.tarifs'),
      desc: actCount > 0
        ? `${actCount} acte${actCount > 1 ? 's' : ''} configuré${actCount > 1 ? 's' : ''} · remise Premium active`
        : t('onboarding.recap.check.tarifsNone'),
      ok: actCount > 0,
    },
    {
      stepIdx: 5,
      title: t('onboarding.recap.check.documents'),
      desc:
        templateCount > 0
          ? `${templateCount} modèle${templateCount > 1 ? 's' : ''} prêt${templateCount > 1 ? 's' : ''} — en-tête personnalisé`
          : t('onboarding.recap.check.documentsNone'),
      ok: templateCount > 0,
    },
  ];

  const nextSteps = [
    { t: t('onboarding.recap.next.import.t'), d: t('onboarding.recap.next.import.d'), cta: t('onboarding.recap.next.import.cta') },
    { t: t('onboarding.recap.next.online.t'), d: t('onboarding.recap.next.online.d'), cta: t('onboarding.recap.next.online.cta') },
    { t: t('onboarding.recap.next.mail.t'), d: t('onboarding.recap.next.mail.d'), cta: t('onboarding.recap.next.mail.cta') },
    { t: t('onboarding.recap.next.test.t'), d: t('onboarding.recap.next.test.d'), cta: t('onboarding.recap.next.test.cta') },
  ];

  return (
    <>
      <h1 className="ob-title">{t('onboarding.recap.title')}</h1>
      <p className="ob-sub">{t('onboarding.recap.sub')}</p>

      {/* Success banner */}
      <div
        role="status"
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          padding: '14px 18px',
          background: '#DEF0E6',
          border: '1px solid #2F8F6B',
          borderRadius: 8,
          marginBottom: 24,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: '#2F8F6B',
            color: '#fff',
            flex: '0 0 auto',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1F5C46' }}>
            {t('onboarding.recap.bannerTitle')}
          </div>
          <div style={{ fontSize: 12, color: '#2F8F6B', marginTop: 2 }}>
            {t('onboarding.recap.bannerBody')}
          </div>
        </div>
      </div>

      {/* Summary table */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink-2)',
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {t('onboarding.recap.summary')}
      </div>
      <Panel className="ob-form-panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 26 }}>
        {checks.map((c, i) => (
          <div
            key={c.title}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr auto',
              alignItems: 'center',
              padding: '14px 16px',
              borderBottom: i < checks.length - 1 ? '1px solid var(--border-soft)' : 'none',
              gap: 12,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-grid',
                placeItems: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: c.ok ? '#DEF0E6' : '#FBEFE3',
                color: c.ok ? '#2F8F6B' : '#C68A2E',
              }}
            >
              {c.ok ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span style={{ fontSize: 11, fontWeight: 700 }}>!</span>
              )}
            </span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>{c.title}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>{c.desc}</div>
            </div>
            <button
              type="button"
              onClick={() => onGoToStep(c.stepIdx)}
              style={{
                background: 'transparent',
                border: '1px solid transparent',
                padding: '4px 10px',
                fontSize: 12,
                color: 'var(--ink-3)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                borderRadius: 4,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg)';
                e.currentTarget.style.color = 'var(--ink)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--ink-3)';
              }}
            >
              {t('onboarding.recap.edit')}
            </button>
          </div>
        ))}
      </Panel>

      {/* Next-steps cards */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ink-2)',
          marginBottom: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {t('onboarding.recap.nextSteps')}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {nextSteps.map((s) => (
          <Panel key={s.t} style={{ padding: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{s.t}</div>
            <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4, marginBottom: 10 }}>
              {s.d}
            </div>
            <a style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{s.cta}</a>
          </Panel>
        ))}
      </div>
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
