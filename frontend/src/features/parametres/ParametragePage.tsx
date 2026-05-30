/**
 * Screen 13 — Paramétrage (desktop).
 * 4 onglets : Cabinet (settings) / Tarifs (tier discounts) / Utilisateurs / Congés.
 */
import { Fragment, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import { Input, Select } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Trash } from '@/components/icons';
import {
  useClinicSettings,
  useUpdateClinicSettings,
  useTiers,
  useUpdateTierDiscount,
  type ClinicSettingsForm,
  type EstablishmentType,
} from './hooks/useSettings';
import {
  useRolePermissions,
  useUpdateRolePermissions,
  type PermissionFlag,
  type RoleCode,
} from './hooks/useRolePermissions';
import { toProblemDetail } from '@/lib/api/problemJson';
import { useLeaves } from './hooks/useLeaves';
import { useCreateLeave } from './hooks/useCreateLeave';
import { useDeleteLeave } from './hooks/useDeleteLeave';
import { usePractitioners } from './hooks/usePractitioners';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { PrestationsTab } from './components/PrestationsTab';
import { PrescriptionTemplatesTab } from './components/PrescriptionTemplatesTab';
import { LogoSettingsSection } from './components/LogoSettingsSection';
import { RoomsManagementSection } from './components/RoomsManagementSection';
import { AgendaIsolationToggle } from './components/AgendaIsolationToggle';
import { OrphanRolesPanel } from './components/OrphanRolesPanel';
import { ModulesPanel } from './components/ModulesPanel';
import { BackupRestorePanel } from './components/BackupRestorePanel';
import { LanguageSettingsSection } from './components/LanguageSettingsSection';
import { AppearanceSettingsSection } from './components/AppearanceSettingsSection';
import { UtilisateursTab } from './components/UtilisateursTab';
import { VaccinationParamTab } from '@/features/vaccination/components/VaccinationParamTab';
import { StockParamTab } from '@/features/stock/components/StockParamTab';
import { ChambresLitsTab } from '@/features/hospitalisation/components/ChambresLitsTab';
import { ConsentTemplatesTab } from '@/features/consent/components/ConsentTemplatesTab';
import { LetterTemplatesTab } from '@/features/confrere/components/LetterTemplatesTab';
import { SupportTab } from './components/SupportTab';
import './parametres.css';

const NAV_MAP = {
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
} as const;

type Tab = 'cabinet' | 'tarifs' | 'prestations' | 'modeles' | 'utilisateurs' | 'conges' | 'droits' | 'vaccinations' | 'stock' | 'hospitalisation' | 'consentements' | 'courriers' | 'support';

function buildTabs(
  type: EstablishmentType | undefined,
  hospitalizationEnabled: boolean,
  isAdmin: boolean,
  t: (k: string) => string,
): { id: Tab; label: string }[] {
  return [
    { id: 'cabinet', label: t('settings.tab.cabinet.' + (type ?? 'CABINET')) },
    { id: 'tarifs', label: t('settings.tab.tarifs') },
    { id: 'prestations', label: t('settings.tab.prestations') },
    { id: 'modeles', label: t('settings.tab.modeles') },
    // QA9-13 — modèles de consentement : gestion réservée à l'ADMIN.
    ...(isAdmin ? [{ id: 'consentements' as Tab, label: t('settings.tab.consentements') }] : []),
    // Modèles de courrier au confrère : gestion réservée à l'ADMIN.
    ...(isAdmin ? [{ id: 'courriers' as Tab, label: t('settings.tab.courriers') }] : []),
    { id: 'utilisateurs', label: t('settings.tab.utilisateurs') },
    { id: 'conges', label: t('settings.tab.conges') },
    { id: 'droits', label: t('settings.tab.droits') },
    { id: 'vaccinations', label: t('settings.tab.vaccinations') },
    { id: 'stock', label: t('settings.tab.stock') },
    // V054 — onglet conditionnel : seulement si l'établissement hospitalise.
    ...(hospitalizationEnabled ? [{ id: 'hospitalisation' as Tab, label: t('settings.tab.hospitalisation') }] : []),
    // Support éditeur — ADMIN uniquement, dernier onglet.
    ...(isAdmin ? [{ id: 'support' as Tab, label: t('settings.tab.support') }] : []),
  ];
}

const EMPTY_FORM: ClinicSettingsForm = {
  name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  inpe: '',
  cnom: '',
  ice: '',
  rib: '',
  establishmentType: 'CABINET',
  imagingInternal: false,
  labInternal: false,
  pharmacyInternal: false,
  hospitalizationEnabled: false,
};

const ESTABLISHMENT_TYPES: EstablishmentType[] = [
  'CABINET', 'CLINIQUE', 'HOPITAL', 'CENTRE_MEDICAL', 'AUTRE',
];

// ── Cabinet tab ───────────────────────────────────────────────────────────────

/**
 * #112/#3 — petit badge « Super admin » sur les sections sensibles (Identité,
 * Services internes, Hospitalisation, Langue) pour signaler — y compris à un
 * super admin — que ces réglages sont réservés au super administrateur. La garde
 * réelle est backend (403) + le fieldset grisé pour un ADMIN normal.
 */
function SuperAdminBadge() {
  const { t } = useT();
  return (
    <span
      title="Réservé au super administrateur"
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: 'var(--primary)',
        background: 'var(--primary-soft)',
        border: '1px solid var(--primary)',
        borderRadius: 999,
        padding: '1px 8px',
        whiteSpace: 'nowrap',
      }}
    >
      🔒 {t('settings.superAdminBadge')}
    </span>
  );
}

function CabinetTab() {
  const { settings, isLoading } = useClinicSettings();
  const { update, isPending } = useUpdateClinicSettings();
  const [form, setForm] = useState<ClinicSettingsForm>(EMPTY_FORM);
  const [hydrated, setHydrated] = useState(false);
  // V069 — Identité du centre, Services internes et Hospitalisation sont
  // réservés au super administrateur. Un ADMIN normal voit ces champs en
  // lecture seule (fieldset disabled + bouton Enregistrer masqué). La garde
  // réelle est côté backend (SettingsController.requireSuperAdminIfProtectedChanges).
  const isSuperAdmin = useAuthStore((s) => s.hasRole('SUPER_ADMIN'));
  const { t } = useT();

  useEffect(() => {
    if (settings && !hydrated) {
      setForm({
        name: settings.name,
        address: settings.address,
        city: settings.city,
        phone: settings.phone,
        email: settings.email ?? '',
        inpe: settings.inpe ?? '',
        cnom: settings.cnom ?? '',
        ice: settings.ice ?? '',
        rib: settings.rib ?? '',
        establishmentType: settings.establishmentType ?? 'CABINET',
        imagingInternal: settings.imagingInternal ?? false,
        labInternal: settings.labInternal ?? false,
        pharmacyInternal: settings.pharmacyInternal ?? false,
        hospitalizationEnabled: settings.hospitalizationEnabled ?? false,
      });
      setHydrated(true);
    }
  }, [settings, hydrated]);

  function setField<K extends keyof ClinicSettingsForm>(key: K, value: ClinicSettingsForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update(form);
      toast.success(t('settings.saved'));
    } catch {
      toast.error(t('common.saveError'));
    }
  }

  const headerLabel = t(`settings.identity.header.${form.establishmentType ?? 'CABINET'}`);

  return (
    <>
    <Panel>
      <PanelHeader>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerLabel} <SuperAdminBadge />
        </span>
      </PanelHeader>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
      >
        {isLoading && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--ink-3)', fontSize: 12 }}>
            {t('common.loading')}
          </div>
        )}
        {!isSuperAdmin && (
          <div
            role="note"
            style={{
              gridColumn: '1 / -1',
              fontSize: 12,
              color: 'var(--ink-2)',
              background: 'var(--amber-soft, #fff4e0)',
              border: '1px solid var(--amber, #e0a23a)',
              borderRadius: 'var(--r-md, 8px)',
              padding: '8px 12px',
            }}
          >
            {t('settings.readonlyNote')}
          </div>
        )}
        {/* V069 — fieldset disabled grise tous les contrôles pour un non-super-admin.
            display:contents préserve la grille du formulaire. */}
        <fieldset
          disabled={!isSuperAdmin}
          style={{ display: 'contents', border: 0, margin: 0, padding: 0 }}
        >
        <Field>
          <FieldLabel htmlFor="cab-type">{t('settings.identity.type')}</FieldLabel>
          <Select
            id="cab-type"
            aria-label={t('settings.estType.aria')}
            value={form.establishmentType ?? 'CABINET'}
            onChange={(e) => setField('establishmentType', e.target.value as ClinicSettingsForm['establishmentType'])}
            style={{
              height: 38,
              padding: '0 10px',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg)',
              fontFamily: 'inherit',
              fontSize: 13,
              width: '100%',
            }}
          >
            {ESTABLISHMENT_TYPES.map((v) => (
              <option key={v} value={v}>{t(`settings.estType.${v}`)}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-name">{t('settings.identity.name')}</FieldLabel>
          <Input
            id="cab-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="El Amrani"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-phone">{t('settings.identity.phone')}</FieldLabel>
          <Input
            id="cab-phone"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+212 5 22 47 85 20"
          />
        </Field>
        <Field style={{ gridColumn: '1 / -1' }}>
          <FieldLabel htmlFor="cab-address">{t('settings.identity.address')}</FieldLabel>
          <Input
            id="cab-address"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="24, Rue Tahar Sebti — Quartier Gauthier"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-city">{t('settings.identity.city')}</FieldLabel>
          <Input
            id="cab-city"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="Casablanca"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-email">{t('settings.identity.email')}</FieldLabel>
          <Input
            id="cab-email"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="contact@cabinet.ma"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-inpe">INPE</FieldLabel>
          <Input id="cab-inpe" value={form.inpe} onChange={(e) => setField('inpe', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-cnom">N° CNOM</FieldLabel>
          <Input id="cab-cnom" value={form.cnom} onChange={(e) => setField('cnom', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-ice">ICE</FieldLabel>
          <Input id="cab-ice" value={form.ice} onChange={(e) => setField('ice', e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-rib">RIB</FieldLabel>
          <Input id="cab-rib" value={form.rib} onChange={(e) => setField('rib', e.target.value)} />
        </Field>
        <div
          style={{
            gridColumn: '1 / -1',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '12px 14px',
            background: 'var(--bg-2, #fafafa)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('settings.services.title')} <SuperAdminBadge />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
            {t('settings.services.hint')}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.labInternal}
              onChange={(e) => setField('labInternal', e.target.checked)}
            />
            {t('settings.services.lab')}
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.imagingInternal}
              onChange={(e) => setField('imagingInternal', e.target.checked)}
            />
            {t('settings.services.imaging')}
          </label>
          {/* V057 (QA9-5) — pharmacie interne : active le prix interne sur le catalogue
              médicaments + l'option "fournir en interne" à la prescription. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.pharmacyInternal}
              onChange={(e) => setField('pharmacyInternal', e.target.checked)}
            />
            {t('settings.services.pharmacy')}
          </label>
        </div>
        <div
          style={{
            gridColumn: '1 / -1',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            padding: '12px 14px',
            background: 'var(--bg-2, #fafafa)',
          }}
        >
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('settings.hosp.title')} <SuperAdminBadge />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
            {t('settings.hosp.hint')}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.hospitalizationEnabled}
              onChange={(e) => setField('hospitalizationEnabled', e.target.checked)}
            />
            {t('settings.hosp.toggle')}
          </label>
        </div>
        {isSuperAdmin && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? t('common.saving') : t('common.save')}
            </Button>
          </div>
        )}
        </fieldset>
      </form>
    </Panel>
    <div style={{ height: 16 }} />
    <LogoSettingsSection />
    <div style={{ height: 16 }} />
    <RoomsManagementSection />
    <div style={{ height: 16 }} />
    <AgendaIsolationToggle />
    <div style={{ height: 16 }} />
    <OrphanRolesPanel module="vaccination" />
    <div style={{ height: 16 }} />
    <OrphanRolesPanel module="pregnancy" />
    <div style={{ height: 16 }} />
    <LanguageSettingsSection />
    <div style={{ height: 16 }} />
    <AppearanceSettingsSection />
    <div style={{ height: 16 }} />
    <ModulesPanel />
    <div style={{ height: 16 }} />
    <BackupRestorePanel />
    </>
  );
}

// ── Tarifs tab ────────────────────────────────────────────────────────────────

function TarifsTab() {
  const { t: tr } = useT();
  const { tiers } = useTiers();
  const { updateTier, isPending } = useUpdateTierDiscount();
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(tiers.map((t) => [t.tier, t.discountPercent])));
  }, [tiers]);

  async function handleSave(tier: 'NORMAL' | 'PREMIUM') {
    const value = drafts[tier];
    if (value === undefined || value < 0 || value > 100) {
      toast.error(tr('settings.tarifs.rangeError'));
      return;
    }
    try {
      await updateTier({ tier, discountPercent: value });
      toast.success(tr('settings.tarifs.saved'));
    } catch {
      toast.error(tr('common.updateError'));
    }
  }

  return (
    <Panel>
      <PanelHeader>{tr('settings.tarifs.title')}</PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {tr('settings.tarifs.hint')}
        </div>
        {tiers.map((t) => (
          <div
            key={t.tier}
            style={{
              display: 'grid',
              gridTemplateColumns: '120px 1fr 100px 120px',
              gap: 10,
              alignItems: 'center',
              padding: '10px 14px',
              background: 'var(--surface-2)',
              borderRadius: 6,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              {t.tier === 'PREMIUM' ? `🌟 ${tr('settings.tarifs.premium')}` : tr('settings.tarifs.normal')}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {t.tier === 'PREMIUM'
                ? tr('settings.tarifs.premiumDesc')
                : tr('settings.tarifs.normalDesc')}
            </span>
            <Input
              type="number"
              min={0}
              max={100}
              step="0.5"
              value={drafts[t.tier] ?? t.discountPercent}
              onChange={(e) =>
                setDrafts((d) => ({ ...d, [t.tier]: Number(e.target.value) || 0 }))
              }
            />
            <Button
              size="sm"
              variant="primary"
              disabled={isPending}
              onClick={() => void handleSave(t.tier)}
            >
              {tr('common.save')}
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}


// ── Congés tab (extracted from CongesPage) ────────────────────────────────────

const MONTHS_FR = [
  'jan.', 'fév.', 'mar.', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sep.', 'oct.', 'nov.', 'déc.',
];

function formatDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()] ?? ''} ${d.getFullYear()}`;
}

function isFuture(endDate: string): boolean {
  return new Date(endDate + 'T23:59:59') >= new Date();
}

function CongesTab() {
  // Multi-praticien : si plusieurs MEDECIN actifs sont visibles, on expose un
  // selector pour gérer les congés de l'un d'eux. Le MEDECIN connecté est
  // pré-sélectionné par défaut (donc en mode solo, l'expérience reste la
  // même qu'avant : tu gères tes propres congés sans rien voir d'extra).
  const { t } = useT();
  const currentUser = useAuthStore((s) => s.user);
  const { practitioners } = usePractitioners();
  const activePractitioners = practitioners.filter((p) => p.active);
  const showPractitionerSelector = activePractitioners.length >= 2;
  const isMedecin = (currentUser?.roles ?? []).includes('MEDECIN');
  const defaultPractitionerId =
    isMedecin && currentUser?.id
      ? currentUser.id
      : (activePractitioners[0]?.id ?? '');
  const [practitionerId, setPractitionerId] = useState<string>(defaultPractitionerId);
  // Synchroniser dès que la liste arrive (premier rendu = liste vide → fallback)
  useEffect(() => {
    if (!practitionerId && defaultPractitionerId) setPractitionerId(defaultPractitionerId);
  }, [defaultPractitionerId, practitionerId]);

  const { leaves, isLoading, error } = useLeaves(practitionerId || undefined);
  const { createLeave, isPending, error: createError } = useCreateLeave(practitionerId || undefined);
  const { deleteLeave, isDeletingId } = useDeleteLeave(practitionerId || undefined);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!startDate || !endDate) {
      setFormError(t('settings.conges.errDates'));
      return;
    }
    if (endDate < startDate) {
      setFormError(t('settings.conges.errOrder'));
      return;
    }
    await createLeave({ startDate, endDate, ...(reason ? { reason } : {}) }).catch(() => null);
    setStartDate('');
    setEndDate('');
    setReason('');
  }

  return (
    <Panel>
      <PanelHeader>{t('settings.conges.title')}</PanelHeader>
      <div style={{ padding: 16 }}>
        {showPractitionerSelector && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <FieldLabel htmlFor="leave-practitioner" style={{ marginBottom: 0 }}>{t('settings.conges.doctor')}</FieldLabel>
            <Select
              id="leave-practitioner"
              aria-label={t('settings.conges.selectDoctor')}
              value={practitionerId}
              onChange={(e) => setPractitionerId(e.target.value)}
              style={{
                height: 36,
                padding: '0 10px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                background: 'var(--bg)',
                fontFamily: 'inherit',
                fontSize: 13,
                minWidth: 240,
              }}
            >
              {activePractitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  Dr {p.lastName} {p.firstName}
                  {p.specialty ? ` — ${p.specialty}` : ''}
                </option>
              ))}
            </Select>
          </div>
        )}
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="params-leave-form">
            <Field>
              <FieldLabel htmlFor="leave-start">{t('settings.conges.start')}</FieldLabel>
              <Input id="leave-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="leave-end">{t('settings.conges.end')}</FieldLabel>
              <Input id="leave-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="leave-reason">{t('settings.conges.reason')}</FieldLabel>
              <Input id="leave-reason" placeholder={t('settings.conges.reasonPlaceholder')} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>&nbsp;</FieldLabel>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? t('settings.conges.adding') : t('common.add')}
              </Button>
            </Field>
          </div>
          {(formError ?? createError) && (
            <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>
              {formError ?? createError}
            </div>
          )}
        </form>

        <div className="params-leave-list">
          {isLoading && <div className="params-leave-empty">{t('common.loading')}</div>}
          {error && (
            <div className="params-leave-empty" style={{ color: 'var(--danger)' }}>{error}</div>
          )}
          {!isLoading && !error && leaves.length === 0 && (
            <div className="params-leave-empty">{t('settings.conges.empty')}</div>
          )}
          {leaves.map((l) => {
            const upcoming = isFuture(l.endDate);
            return (
              <div key={l.id} className="params-leave-row">
                <div className="params-leave-period">
                  {formatDate(l.startDate)}
                  {l.startDate !== l.endDate && ` → ${formatDate(l.endDate)}`}
                </div>
                <div className="params-leave-reason">{l.reason ?? ''}</div>
                <span className={`params-leave-badge${upcoming ? '' : ' past'}`}>
                  {upcoming ? t('settings.conges.upcoming') : t('settings.conges.past')}
                </span>
                <Button
                  variant="ghost"
                  iconOnly
                  size="sm"
                  aria-label={t('settings.conges.deleteAria')}
                  disabled={isDeletingId === l.id}
                  onClick={() => { void deleteLeave(l.id); }}
                >
                  <Trash />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

// ── Droits d'accès tab (QA3-3 v1) ─────────────────────────────────────────────

const PERMISSIONS: { code: string; categoryKey: string }[] = [
  { code: 'PATIENT_CREATE',     categoryKey: 'perm.cat.patients' },
  { code: 'PATIENT_READ',       categoryKey: 'perm.cat.patients' },
  { code: 'APPOINTMENT_READ',   categoryKey: 'perm.cat.rdv' },
  { code: 'APPOINTMENT_CREATE', categoryKey: 'perm.cat.rdv' },
  { code: 'ARRIVAL_DECLARE',    categoryKey: 'perm.cat.salle' },
  { code: 'VITALS_RECORD',      categoryKey: 'perm.cat.salle' },
  { code: 'INVOICE_READ',       categoryKey: 'perm.cat.factu' },
  { code: 'INVOICE_ISSUE',      categoryKey: 'perm.cat.factu' },
  // QA5-1 — administre les sources d'import auto + valide / rejette les
  // documents arrivés dans la corbeille. Distincte de l'upload manuel.
  { code: 'DOCUMENT_IMPORT_ADMIN', categoryKey: 'perm.cat.documents' },
  // V016 — administre le catalogue des prestations (CRUD + tarifs).
  { code: 'PRESTATION_ADMIN', categoryKey: 'perm.cat.prestations' },
  // V018 — import CSV des catalogues médicaments / analyses / radio.
  { code: 'CATALOG_IMPORT', categoryKey: 'perm.cat.catalogue' },
];

const ROLES: { code: RoleCode; readOnly: boolean }[] = [
  { code: 'SECRETAIRE', readOnly: false },
  { code: 'ASSISTANT',  readOnly: false },
  { code: 'MEDECIN',    readOnly: true },
  { code: 'ADMIN',      readOnly: true },
];

// Réceptionniste = bureau des admissions ; n'apparaît dans la matrice que
// lorsque l'établissement hospitalise (clinique / hôpital).
const RECEPTIONNISTE_ROLE: { code: RoleCode; readOnly: boolean } = {
  code: 'RECEPTIONNISTE',
  readOnly: false,
};

function DroitsTab() {
  const { t } = useT();
  const { rows, isLoading, error } = useRolePermissions();
  const { update, isPending } = useUpdateRolePermissions();
  const { settings } = useClinicSettings();
  const hospitalizationEnabled =
    settings?.hospitalizationEnabled === true ||
    settings?.establishmentType === 'CLINIQUE' ||
    settings?.establishmentType === 'HOPITAL';
  const ROLES_VISIBLE = hospitalizationEnabled
    ? [...ROLES, RECEPTIONNISTE_ROLE]
    : ROLES;

  // Build a quick lookup: roleCode -> { permission -> granted }
  const matrix = new Map<string, Map<string, boolean>>();
  for (const r of ROLES_VISIBLE) matrix.set(r.code, new Map());
  for (const row of rows) {
    matrix.get(row.roleCode)?.set(row.permission, row.granted);
  }

  async function toggle(roleCode: RoleCode, permission: string, current: boolean) {
    const flag: PermissionFlag = { permission, granted: !current };
    try {
      await update({ roleCode, permissions: [flag] });
      toast.success(t('settings.droits.saved'));
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
    }
  }

  const grouped = new Map<string, typeof PERMISSIONS>();
  for (const p of PERMISSIONS) {
    if (!grouped.has(p.categoryKey)) grouped.set(p.categoryKey, []);
    grouped.get(p.categoryKey)!.push(p);
  }

  return (
    <Panel>
      <PanelHeader>
        <span>{t('settings.droits.title')}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          {t('settings.droits.note')}
        </span>
      </PanelHeader>
      <div style={{ padding: 16, overflowX: 'auto' }}>
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}
        {isLoading ? (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('common.loading')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                  {t('settings.droits.feature')}
                </th>
                {ROLES_VISIBLE.map((r) => (
                  <th key={r.code} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600, textAlign: 'center', minWidth: 100 }}>
                    {t(`role.${r.code}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([cat, perms]) => (
                <Fragment key={cat}>
                  <tr>
                    <td colSpan={ROLES_VISIBLE.length + 1} style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {t(cat)}
                    </td>
                  </tr>
                  {perms.map((p) => {
                    const permLabel = t(`perm.${p.code}`);
                    return (
                    <tr key={p.code}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                        {permLabel}
                      </td>
                      {ROLES_VISIBLE.map((r) => {
                        const granted = matrix.get(r.code)?.get(p.code) ?? false;
                        return (
                          <td key={r.code} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={granted}
                              disabled={r.readOnly || isPending}
                              onChange={() => void toggle(r.code, p.code, granted)}
                              aria-label={t('settings.droits.aria', { perm: permLabel, role: t(`role.${r.code}`) })}
                              style={{ width: 16, height: 16, cursor: r.readOnly ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {t('settings.droits.notev1')}
        </div>
      </div>
    </Panel>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ParametragePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('cabinet');
  const { settings } = useClinicSettings();
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = (currentUser?.roles ?? []).includes('ADMIN');
  const { t } = useT();
  const tabs = buildTabs(settings?.establishmentType, settings?.hospitalizationEnabled ?? false, isAdmin, t);

  return (
    <Screen
      active="params"
      title={t('nav.params')}
      sub={tabs.find((tb) => tb.id === tab)?.label ?? ''}
      onNavigate={(id) => navigate(NAV_MAP[id])}
    >
      <div
        style={{
          display: 'flex',
          gap: 6,
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
        role="tablist"
        aria-label={t('settings.tabsAria')}
      >
        {tabs.map((tb) => (
          <button
            key={tb.id}
            type="button"
            role="tab"
            aria-selected={tab === tb.id}
            onClick={() => setTab(tb.id)}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--border)',
              borderRadius: 999,
              background: tab === tb.id ? 'var(--primary)' : 'var(--surface)',
              color: tab === tb.id ? 'white' : 'var(--ink-2)',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 550,
              cursor: 'pointer',
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>
      <div style={{ padding: 24, overflow: 'auto', flex: 1 }} className="scroll">
        {tab === 'cabinet' && <CabinetTab />}
        {tab === 'tarifs' && <TarifsTab />}
        {tab === 'prestations' && <PrestationsTab />}
        {tab === 'modeles' && <PrescriptionTemplatesTab />}
        {tab === 'consentements' && isAdmin && <ConsentTemplatesTab />}
        {tab === 'courriers' && isAdmin && <LetterTemplatesTab />}
        {tab === 'utilisateurs' && <UtilisateursTab />}
        {tab === 'conges' && <CongesTab />}
        {tab === 'droits' && (
          <>
            <DroitsTab />
            {/* #2 — l'habilitation des modules (activer/désactiver une fonctionnalité
                pour tout le cabinet) est attendue ici, dans « Droits d'accès ». Ce
                n'est pas une permission par rôle (donc pas une colonne de la matrice)
                mais un interrupteur global par module — rendu juste en dessous. */}
            <div style={{ height: 16 }} />
            <ModulesPanel />
          </>
        )}
        {tab === 'vaccinations' && <VaccinationParamTab />}
        {tab === 'stock' && <StockParamTab />}
        {tab === 'hospitalisation' && <ChambresLitsTab />}
        {tab === 'support' && isAdmin && <SupportTab />}
      </div>
    </Screen>
  );
}
