/**
 * Screen 13 — Paramétrage (desktop).
 * 4 onglets : Cabinet (settings) / Tarifs (tier discounts) / Utilisateurs / Congés.
 */
import { useEffect, useState } from 'react';
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
  type ClinicSettingsForm,
} from './hooks/useSettings';
import { useUsers, useCreateUser, useDeactivateUser } from './hooks/useUsers';
import { useLeaves } from './hooks/useLeaves';
import { useCreateLeave } from './hooks/useCreateLeave';
import { useDeleteLeave } from './hooks/useDeleteLeave';
import './parametres.css';

const NAV_MAP = {
  agenda: '/agenda',
  patients: '/patients',
  salle: '/salle',
  consult: '/consultations',
  factu: '/facturation',
  params: '/parametres',
} as const;

type Tab = 'cabinet' | 'tarifs' | 'utilisateurs' | 'conges';

const TABS: { id: Tab; label: string }[] = [
  { id: 'cabinet', label: 'Cabinet' },
  { id: 'tarifs', label: 'Tarifs' },
  { id: 'utilisateurs', label: 'Utilisateurs' },
  { id: 'conges', label: 'Congés' },
];

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
};

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
      toast.success('Paramètres cabinet enregistrés.');
    } catch {
      toast.error('Échec de la sauvegarde.');
    }
  }

  return (
    <Panel>
      <PanelHeader>Identité du cabinet</PanelHeader>
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
          <FieldLabel htmlFor="cab-name">Nom *</FieldLabel>
          <Input
            id="cab-name"
            value={form.name}
            onChange={(e) => setField('name', e.target.value)}
            placeholder="Cabinet Médical El Amrani"
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
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </form>
    </Panel>
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
              onClick={() => void handleSave(t.tier as 'NORMAL' | 'PREMIUM')}
            >
              Enregistrer
            </Button>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Utilisateurs tab ──────────────────────────────────────────────────────────

function UtilisateursTab() {
  const { users, isLoading, error } = useUsers();
  const { createUser, isPending } = useCreateUser();
  const { deactivateUser, isPending: isDeactivating } = useDeactivateUser();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: 'SECRETAIRE' as 'SECRETAIRE' | 'ASSISTANT' | 'MEDECIN' | 'ADMIN',
  });

  async function handleCreate() {
    if (!draft.email || !draft.password || !draft.firstName || !draft.lastName) {
      toast.error('Email, mot de passe, prénom et nom requis.');
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
      toast.success('Utilisateur créé.');
      setShowForm(false);
      setDraft({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: '',
        role: 'SECRETAIRE',
      });
    } catch {
      toast.error('Création refusée.');
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <span>Utilisateurs du cabinet</span>
        <Button
          size="sm"
          variant="primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Fermer' : 'Nouveau'}
        </Button>
      </PanelHeader>
      <div style={{ padding: 16 }}>
        {showForm && (
          <div
            style={{
              padding: 14,
              border: '1px solid var(--primary)',
              background: 'var(--primary-soft)',
              borderRadius: 8,
              marginBottom: 14,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
            }}
          >
            <Field>
              <FieldLabel>Email *</FieldLabel>
              <Input value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel>Mot de passe initial *</FieldLabel>
              <Input
                type="password"
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel>Rôle</FieldLabel>
              <select
                value={draft.role}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    role: e.target.value as 'SECRETAIRE' | 'ASSISTANT' | 'MEDECIN' | 'ADMIN',
                  })
                }
                style={{
                  height: 36,
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0 10px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  background: 'var(--surface)',
                }}
              >
                <option value="SECRETAIRE">Secrétaire</option>
                <option value="ASSISTANT">Assistant(e)</option>
                <option value="MEDECIN">Médecin</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </Field>
            <Field>
              <FieldLabel>Prénom *</FieldLabel>
              <Input value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel>Nom *</FieldLabel>
              <Input value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
            </Field>
            <Field>
              <FieldLabel>Téléphone</FieldLabel>
              <Input value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
            </Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button onClick={() => setShowForm(false)}>Annuler</Button>
              <Button variant="primary" disabled={isPending} onClick={() => void handleCreate()}>
                {isPending ? 'Création…' : 'Créer'}
              </Button>
            </div>
          </div>
        )}

        {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>}
        {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
        {users.length === 0 && !isLoading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Aucun utilisateur.</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {users.map((u) => (
            <div
              key={u.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                opacity: u.enabled ? 1 : 0.5,
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {u.firstName} {u.lastName}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
                  {u.email} {u.phone ? `· ${u.phone}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {u.roles.map((r) => (
                  <span
                    key={r}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>
              {u.enabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Désactiver l'utilisateur"
                  disabled={isDeactivating}
                  onClick={() => void deactivateUser(u.id)}
                >
                  <Trash />
                </Button>
              )}
              {!u.enabled && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Désactivé</span>
              )}
            </div>
          ))}
        </div>
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
  const { leaves, isLoading, error } = useLeaves();
  const { createLeave, isPending, error: createError } = useCreateLeave();
  const { deleteLeave, isDeletingId } = useDeleteLeave();
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ParametragePage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('cabinet');

  return (
    <Screen
      active="params"
      title="Paramètres"
      sub={TABS.find((t) => t.id === tab)?.label ?? ''}
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
        {TABS.map((t) => (
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
        {tab === 'utilisateurs' && <UtilisateursTab />}
        {tab === 'conges' && <CongesTab />}
      </div>
    </Screen>
  );
}
