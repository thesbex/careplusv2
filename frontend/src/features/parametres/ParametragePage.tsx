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
import { Input } from '@/components/ui/Input';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Trash } from '@/components/icons';
import {
  useClinicSettings,
  useUpdateClinicSettings,
  useTiers,
  useUpdateTierDiscount,
  ESTABLISHMENT_TYPE_LABELS,
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
import { PrestationsTab } from './components/PrestationsTab';
import { PrescriptionTemplatesTab } from './components/PrescriptionTemplatesTab';
import { LogoSettingsSection } from './components/LogoSettingsSection';
import { RoomsManagementSection } from './components/RoomsManagementSection';
import { AgendaIsolationToggle } from './components/AgendaIsolationToggle';
import { OrphanRolesPanel } from './components/OrphanRolesPanel';
import { UtilisateursTab } from './components/UtilisateursTab';
import { VaccinationParamTab } from '@/features/vaccination/components/VaccinationParamTab';
import { StockParamTab } from '@/features/stock/components/StockParamTab';
import { ChambresLitsTab } from '@/features/hospitalisation/components/ChambresLitsTab';
import { ConsentTemplatesTab } from '@/features/consent/components/ConsentTemplatesTab';
import { LetterTemplatesTab } from '@/features/confrere/components/LetterTemplatesTab';
import { NotificationTemplatesTab } from '@/features/notifications/components/NotificationTemplatesTab';
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

type Tab = 'cabinet' | 'tarifs' | 'prestations' | 'modeles' | 'utilisateurs' | 'conges' | 'droits' | 'vaccinations' | 'stock' | 'hospitalisation' | 'consentements' | 'courriers' | 'notifications';

function establishmentTabLabel(type: EstablishmentType | undefined): string {
  if (!type) return 'Cabinet';
  return ESTABLISHMENT_TYPE_LABELS[type] || 'Établissement';
}

const IDENTITY_HEADER: Record<EstablishmentType, string> = {
  CABINET: 'Identité du cabinet',
  CLINIQUE: 'Identité de la clinique',
  HOPITAL: 'Identité de l’hôpital',
  CENTRE_MEDICAL: 'Identité du centre médical',
  AUTRE: 'Identité de l’établissement',
};

function buildTabs(
  type: EstablishmentType | undefined,
  hospitalizationEnabled: boolean,
  isAdmin: boolean,
): { id: Tab; label: string }[] {
  return [
    { id: 'cabinet', label: establishmentTabLabel(type) },
    { id: 'tarifs', label: 'Tarifs' },
    { id: 'prestations', label: 'Prestations' },
    { id: 'modeles', label: 'Modèles d’ordonnance' },
    // QA9-13 — modèles de consentement : gestion réservée à l'ADMIN.
    ...(isAdmin ? [{ id: 'consentements' as Tab, label: 'Consentements' }] : []),
    // Modèles de courrier au confrère : gestion réservée à l'ADMIN.
    ...(isAdmin ? [{ id: 'courriers' as Tab, label: 'Courriers confrère' }] : []),
    // Notifications sortantes (WhatsApp/email) : gestion réservée à l'ADMIN.
    ...(isAdmin ? [{ id: 'notifications' as Tab, label: 'Notifications' }] : []),
    { id: 'utilisateurs', label: 'Utilisateurs' },
    { id: 'conges', label: 'Congés' },
    { id: 'droits', label: 'Droits d’accès' },
    { id: 'vaccinations', label: 'Vaccinations' },
    { id: 'stock', label: 'Stock' },
    // V054 — onglet conditionnel : seulement si l'établissement hospitalise.
    ...(hospitalizationEnabled ? [{ id: 'hospitalisation' as Tab, label: 'Chambres & lits' }] : []),
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

const ESTABLISHMENT_TYPE_OPTIONS: { value: 'CABINET' | 'CLINIQUE' | 'HOPITAL' | 'CENTRE_MEDICAL' | 'AUTRE'; label: string }[] = [
  { value: 'CABINET', label: 'Cabinet' },
  { value: 'CLINIQUE', label: 'Clinique' },
  { value: 'HOPITAL', label: 'Hôpital' },
  { value: 'CENTRE_MEDICAL', label: 'Centre médical' },
  { value: 'AUTRE', label: 'Autre' },
];

// ── Cabinet tab ───────────────────────────────────────────────────────────────

function CabinetTab() {
  const { settings, isLoading } = useClinicSettings();
  const { update, isPending } = useUpdateClinicSettings();
  const [form, setForm] = useState<ClinicSettingsForm>(EMPTY_FORM);
  const [hydrated, setHydrated] = useState(false);

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
      toast.success('Paramètres enregistrés.');
    } catch {
      toast.error('Échec de la sauvegarde.');
    }
  }

  const headerLabel = IDENTITY_HEADER[form.establishmentType ?? 'CABINET'];

  return (
    <>
    <Panel>
      <PanelHeader>{headerLabel}</PanelHeader>
      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        style={{ padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
      >
        {isLoading && (
          <div style={{ gridColumn: '1 / -1', color: 'var(--ink-3)', fontSize: 12 }}>
            Chargement…
          </div>
        )}
        <Field>
          <FieldLabel htmlFor="cab-type">Type d'établissement *</FieldLabel>
          <select
            id="cab-type"
            aria-label="Type d'établissement"
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
            {ESTABLISHMENT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-name">Nom *</FieldLabel>
          <Input
            id="cab-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="El Amrani"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-phone">Téléphone *</FieldLabel>
          <Input
            id="cab-phone"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value)}
            placeholder="+212 5 22 47 85 20"
          />
        </Field>
        <Field style={{ gridColumn: '1 / -1' }}>
          <FieldLabel htmlFor="cab-address">Adresse *</FieldLabel>
          <Input
            id="cab-address"
            value={form.address}
            onChange={(e) => setField('address', e.target.value)}
            placeholder="24, Rue Tahar Sebti — Quartier Gauthier"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-city">Ville *</FieldLabel>
          <Input
            id="cab-city"
            value={form.city}
            onChange={(e) => setField('city', e.target.value)}
            placeholder="Casablanca"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="cab-email">Email</FieldLabel>
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
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Services internes</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
            Cocher si l'établissement dispose de ces services en interne. Préparation pour le
            routing futur des prescriptions analyses / radio.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.labInternal}
              onChange={(e) => setField('labInternal', e.target.checked)}
            />
            Laboratoire d'analyses interne
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.imagingInternal}
              onChange={(e) => setField('imagingInternal', e.target.checked)}
            />
            Service de radiologie interne
          </label>
          {/* V057 (QA9-5) — pharmacie interne : active le prix interne sur le catalogue
              médicaments + l'option "fournir en interne" à la prescription. */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.pharmacyInternal}
              onChange={(e) => setField('pharmacyInternal', e.target.checked)}
            />
            Pharmacie interne (l'établissement fournit des médicaments)
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
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Hospitalisation</div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}>
            Cocher si l'établissement dispose de lits et hospitalise des patients (clinique,
            hôpital). Active l'onglet « Chambres &amp; lits » et le module de séjour.
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={!!form.hospitalizationEnabled}
              onChange={(e) => setField('hospitalizationEnabled', e.target.checked)}
            />
            Cet établissement hospitalise des patients (lits)
          </label>
        </div>
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
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
    </>
  );
}

// ── Tarifs tab ────────────────────────────────────────────────────────────────

function TarifsTab() {
  const { tiers } = useTiers();
  const { updateTier, isPending } = useUpdateTierDiscount();
  const [drafts, setDrafts] = useState<Record<string, number>>({});

  useEffect(() => {
    setDrafts(Object.fromEntries(tiers.map((t) => [t.tier, t.discountPercent])));
  }, [tiers]);

  async function handleSave(tier: 'NORMAL' | 'PREMIUM') {
    const value = drafts[tier];
    if (value === undefined || value < 0 || value > 100) {
      toast.error('Pourcentage entre 0 et 100.');
      return;
    }
    try {
      await updateTier({ tier, discountPercent: value });
      toast.success('Remise mise à jour.');
    } catch {
      toast.error('Échec de la mise à jour.');
    }
  }

  return (
    <Panel>
      <PanelHeader>Remises automatiques par tier patient</PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          La remise est appliquée automatiquement à la facture lors de la signature de la
          consultation, en fonction du tier renseigné sur le patient.
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
              {t.tier === 'PREMIUM' ? '🌟 Premium' : 'Normal'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {t.tier === 'PREMIUM'
                ? 'Patients identifiés Premium dans le dossier.'
                : 'Patients standards (par défaut).'}
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
              Enregistrer
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
      setFormError('Veuillez renseigner les deux dates.');
      return;
    }
    if (endDate < startDate) {
      setFormError('La date de fin doit être après la date de début.');
      return;
    }
    await createLeave({ startDate, endDate, ...(reason ? { reason } : {}) }).catch(() => null);
    setStartDate('');
    setEndDate('');
    setReason('');
  }

  return (
    <Panel>
      <PanelHeader>Congés &amp; absences</PanelHeader>
      <div style={{ padding: 16 }}>
        {showPractitionerSelector && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
            <FieldLabel htmlFor="leave-practitioner" style={{ marginBottom: 0 }}>Médecin</FieldLabel>
            <select
              id="leave-practitioner"
              aria-label="Sélectionner le médecin"
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
            </select>
          </div>
        )}
        <form onSubmit={(e) => { void handleSubmit(e); }}>
          <div className="params-leave-form">
            <Field>
              <FieldLabel htmlFor="leave-start">Date de début</FieldLabel>
              <Input id="leave-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="leave-end">Date de fin</FieldLabel>
              <Input id="leave-end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="leave-reason">Motif (facultatif)</FieldLabel>
              <Input id="leave-reason" placeholder="Congé annuel, formation…" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>&nbsp;</FieldLabel>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? 'Ajout…' : 'Ajouter'}
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
          {isLoading && <div className="params-leave-empty">Chargement…</div>}
          {error && (
            <div className="params-leave-empty" style={{ color: 'var(--danger)' }}>{error}</div>
          )}
          {!isLoading && !error && leaves.length === 0 && (
            <div className="params-leave-empty">Aucun congé déclaré.</div>
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
                  {upcoming ? 'À venir' : 'Passé'}
                </span>
                <Button
                  variant="ghost"
                  iconOnly
                  size="sm"
                  aria-label="Supprimer ce congé"
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

const PERMISSIONS: { code: string; label: string; category: string }[] = [
  { code: 'PATIENT_CREATE',     label: 'Créer / modifier un patient',           category: 'Patients' },
  { code: 'PATIENT_READ',       label: 'Consulter les détails d’un patient',    category: 'Patients' },
  { code: 'APPOINTMENT_READ',   label: 'Consulter le planning',                 category: 'Rendez-vous' },
  { code: 'APPOINTMENT_CREATE', label: 'Créer un rendez-vous',                  category: 'Rendez-vous' },
  { code: 'ARRIVAL_DECLARE',    label: 'Déclarer l’arrivée d’un patient',       category: 'Salle d’attente' },
  { code: 'VITALS_RECORD',      label: 'Prendre les constantes (poids, tension…)', category: 'Salle d’attente' },
  { code: 'INVOICE_READ',       label: 'Accéder au module facturation',         category: 'Facturation' },
  { code: 'INVOICE_ISSUE',      label: 'Émettre / encaisser une facture',       category: 'Facturation' },
  // QA5-1 — administre les sources d'import auto + valide / rejette les
  // documents arrivés dans la corbeille. Distincte de l'upload manuel.
  { code: 'DOCUMENT_IMPORT_ADMIN', label: "Administrer l'import auto de documents", category: 'Documents' },
  // V016 — administre le catalogue des prestations (CRUD + tarifs).
  { code: 'PRESTATION_ADMIN', label: 'Administrer le catalogue des prestations', category: 'Prestations' },
  // V018 — import CSV des catalogues médicaments / analyses / radio.
  { code: 'CATALOG_IMPORT', label: 'Importer un catalogue (médicaments, analyses, radio)', category: 'Catalogue' },
];

const ROLES: { code: RoleCode; label: string; readOnly: boolean }[] = [
  { code: 'SECRETAIRE', label: 'Secrétaire', readOnly: false },
  { code: 'ASSISTANT',  label: 'Assistant(e)', readOnly: false },
  { code: 'MEDECIN',    label: 'Médecin',    readOnly: true },
  { code: 'ADMIN',      label: 'Administrateur', readOnly: true },
];

// Réceptionniste = bureau des admissions ; n'apparaît dans la matrice que
// lorsque l'établissement hospitalise (clinique / hôpital).
const RECEPTIONNISTE_ROLE: { code: RoleCode; label: string; readOnly: boolean } = {
  code: 'RECEPTIONNISTE',
  label: 'Réceptionniste',
  readOnly: false,
};

function DroitsTab() {
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
      toast.success('Droits mis à jour.');
    } catch (err) {
      const problem = toProblemDetail(err);
      toast.error(problem.title, problem.detail ? { description: problem.detail } : undefined);
    }
  }

  const grouped = new Map<string, typeof PERMISSIONS>();
  for (const p of PERMISSIONS) {
    if (!grouped.has(p.category)) grouped.set(p.category, []);
    grouped.get(p.category)!.push(p);
  }

  return (
    <Panel>
      <PanelHeader>
        <span>Droits d’accès par rôle</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
          MEDECIN / ADMIN ne sont pas modifiables — accès total par défaut.
        </span>
      </PanelHeader>
      <div style={{ padding: 16, overflowX: 'auto' }}>
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>{error}</div>
        )}
        {isLoading ? (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Chargement…</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>
                  Fonctionnalité
                </th>
                {ROLES_VISIBLE.map((r) => (
                  <th key={r.code} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', fontWeight: 600, textAlign: 'center', minWidth: 100 }}>
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([cat, perms]) => (
                <Fragment key={cat}>
                  <tr>
                    <td colSpan={ROLES_VISIBLE.length + 1} style={{ padding: '10px 12px 4px', fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {cat}
                    </td>
                  </tr>
                  {perms.map((p) => (
                    <tr key={p.code}>
                      <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
                        {p.label}
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
                              aria-label={`${p.label} pour ${r.label}`}
                              style={{ width: 16, height: 16, cursor: r.readOnly ? 'not-allowed' : 'pointer' }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Note v1 — la matrice contrôle l’affichage des écrans / actions côté frontend.
          Les endpoints backend appliquent encore les rôles fixes (le verrouillage final
          arrive dans la refonte RBAC complète, voir BACKLOG.md).
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
  const tabs = buildTabs(settings?.establishmentType, settings?.hospitalizationEnabled ?? false, isAdmin);

  return (
    <Screen
      active="params"
      title="Paramètres"
      sub={tabs.find((t) => t.id === tab)?.label ?? ''}
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
        aria-label="Onglets paramètres"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--border)',
              borderRadius: 999,
              background: tab === t.id ? 'var(--primary)' : 'var(--surface)',
              color: tab === t.id ? 'white' : 'var(--ink-2)',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 550,
              cursor: 'pointer',
            }}
          >
            {t.label}
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
        {tab === 'notifications' && isAdmin && <NotificationTemplatesTab />}
        {tab === 'utilisateurs' && <UtilisateursTab />}
        {tab === 'conges' && <CongesTab />}
        {tab === 'droits' && <DroitsTab />}
        {tab === 'vaccinations' && <VaccinationParamTab />}
        {tab === 'stock' && <StockParamTab />}
        {tab === 'hospitalisation' && <ChambresLitsTab />}
      </div>
    </Screen>
  );
}
