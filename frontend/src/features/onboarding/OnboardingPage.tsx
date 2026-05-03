/**
 * Screen 13 — Onboarding wizard (first launch).
 *
 * Wired wizard to the endpoints that already exist (QA backlog "Onboarding 7-step wired"):
 *   1. Cabinet      → PUT /api/settings/clinic
 *   2. Tarifs       → PUT /api/settings/tiers/{NORMAL|PREMIUM}
 *   3. Équipe       → POST /api/admin/users (loop)
 *   4. Récap        → navigate to /agenda
 *
 * Notes (deliberate gaps, tracked in BACKLOG.md):
 *   - "Horaires" + "Documents" steps from the original prototype are dropped because
 *     `config_working_hours` and document templates don't have backends yet.
 *   - First-admin bootstrap (POST /admin/bootstrap) is **not** part of this flow. That
 *     endpoint is for an empty database; once one user exists, it 409s. So the wizard
 *     assumes the user is already signed in (typical post-deploy flow: deploy admin
 *     bootstraps via curl, then logs in and sees this wizard once).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BrandMark } from '@/components/ui/BrandMark';
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
import { useCreateUser } from '@/features/parametres/hooks/useUsers';
import { useAuthStore } from '@/lib/auth/authStore';
import { toProblemDetail } from '@/lib/api/problemJson';
import './onboarding.css';

type StepKey = 'cabinet' | 'tarifs' | 'equipe' | 'recap';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'cabinet', label: 'Cabinet' },
  { key: 'tarifs', label: 'Tarifs' },
  { key: 'equipe', label: 'Équipe' },
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

  // Step 2 — Tarifs
  const { tiers } = useTiers();
  const { updateTier, isPending: isSavingTier } = useUpdateTierDiscount();
  const premium = tiers.find((t) => t.tier === 'PREMIUM');
  const [premiumDiscount, setPremiumDiscount] = useState(0);
  useEffect(() => {
    if (premium) setPremiumDiscount(Number(premium.discountPercent));
  }, [premium]);

  // Step 3 — Équipe
  const { createUser, isPending: isCreatingUser } = useCreateUser();
  const [invited, setInvited] = useState<InvitedUser[]>([]);
  const [draft, setDraft] = useState<InvitedUser>({
    email: '', password: '', firstName: '', lastName: '', phone: '', role: 'SECRETAIRE',
  });

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
    } else if (step.key === 'tarifs') {
      try {
        await updateTier({ tier: 'PREMIUM', discountPercent: premiumDiscount });
        toast.success('Tarifs enregistrés.');
        setStepIdx((i) => i + 1);
      } catch (err) {
        const p = toProblemDetail(err);
        toast.error(p.title, p.detail ? { description: p.detail } : undefined);
      }
    } else if (step.key === 'equipe') {
      // No required action — invitations are optional.
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

  const sessionLabel = sessionUser
    ? `${sessionUser.firstName} ${sessionUser.lastName}`.trim()
    : '—';
  const isPending = isSavingClinic || isSavingTier || isCreatingUser;

  return (
    <div className="ob-root">
      <header className="ob-topbar">
        <BrandMark size="sm" />
        <span className="ob-topbar-name">careplus</span>
        <Pill style={{ marginLeft: 10 }}>Configuration initiale</Pill>
        <span className="ob-topbar-session">Session : {sessionLabel}</span>
      </header>

      <nav className="ob-rail" aria-label="Étapes de configuration">
        <ol className="ob-steps">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const active = i === stepIdx;
            return (
              <li
                key={s.key}
                className={`ob-step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
                aria-current={active ? 'step' : undefined}
              >
                <span className="ob-step-circle">{done ? <Check /> : i + 1}</span>
                <span className="ob-step-label">{s.label}</span>
              </li>
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

            {step.key === 'tarifs' && (
              <TarifsStep premiumDiscount={premiumDiscount} setPremiumDiscount={setPremiumDiscount} />
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

            {step.key === 'recap' && (
              <RecapStep clinicName={clinic.name} city={clinic.city} invitedCount={invited.length} />
            )}
          </div>
        </div>
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
              ? 'Aller à l’agenda'
              : isPending
                ? 'Enregistrement…'
                : 'Continuer'}
            {step.key !== 'recap' && <ChevronRight />}
          </Button>
        </div>
      </footer>
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

function TarifsStep({
  premiumDiscount,
  setPremiumDiscount,
}: {
  premiumDiscount: number;
  setPremiumDiscount: (n: number) => void;
}) {
  return (
    <>
      <h1 className="ob-title">Tarifs et remises</h1>
      <p className="ob-sub">
        Définissez la remise automatique pour vos patients Premium. Modifiable à tout moment dans Paramétrage › Tarifs.
      </p>
      <Panel className="ob-form-panel">
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
          </div>
        </Field>
      </Panel>
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
      <h1 className="ob-title">Membres de l’équipe</h1>
      <p className="ob-sub">
        Ajoutez les premières secrétaires, assistantes, ou médecins. Vous pourrez en ajouter d’autres plus tard.
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

function RecapStep({
  clinicName,
  city,
  invitedCount,
}: {
  clinicName: string;
  city: string;
  invitedCount: number;
}) {
  return (
    <>
      <h1 className="ob-title">🎉 Tout est prêt</h1>
      <p className="ob-sub">
        {clinicName ? `${clinicName}${city ? ` (${city})` : ''} ` : 'Votre cabinet '}
        est configuré. Vous pouvez maintenant recevoir vos premiers patients.
      </p>
      <Panel className="ob-form-panel">
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <li>✅ Identité et mentions légales du cabinet</li>
          <li>✅ Remise Premium configurée</li>
          <li>{invitedCount > 0 ? `✅ ${invitedCount} membre${invitedCount > 1 ? 's' : ''} ajouté${invitedCount > 1 ? 's' : ''}` : '⚠️ Aucun membre ajouté (vous pouvez le faire plus tard depuis Paramétrage)'}</li>
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
