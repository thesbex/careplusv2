import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Search, Users, Plus, Close } from '@/components/icons';
import { usePatientList } from './hooks/usePatientList';
import {
  useCreatePatient,
  type CreatePatientForm,
  type AllergyEntry,
  type AntecedentEntry,
  type AllergySeverity,
  type AntecedentType,
} from './hooks/useCreatePatient';

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', marginBottom: 4 }}>{children}</div>;
}

function sanitizeName(v: string) {
  return v.replace(/[^a-zA-ZÀ-ÿ؀-ۿ\s'\-]/g, '');
}

function isValidName(v: string) {
  return /^[a-zA-ZÀ-ÿ؀-ۿ\s'\-]{2,}$/.test(v.trim());
}

function SectionHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ fontSize: 11.5, fontWeight: 650, color: 'var(--ink-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </span>
      <button
        type="button"
        onClick={onAdd}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 12, color: 'var(--primary)', fontWeight: 550,
          background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
          borderRadius: 4, fontFamily: 'inherit',
        }}
      >
        <Plus style={{ width: 12, height: 12 }} /> Ajouter
      </button>
    </div>
  );
}

const SEVERITY_LABELS: Record<AllergySeverity, string> = {
  LEGERE: 'Légère',
  MODEREE: 'Modérée',
  SEVERE: 'Sévère',
};

const SEVERITY_COLORS: Record<AllergySeverity, { bg: string; color: string; border: string }> = {
  LEGERE:  { bg: 'var(--green-soft, #E8F5E9)', color: '#2E7D32', border: '#A5D6A7' },
  MODEREE: { bg: 'var(--amber-soft, #FFF8E1)', color: '#E65100', border: '#FFCC80' },
  SEVERE:  { bg: 'var(--danger-soft, #FFEBEE)', color: 'var(--danger)', border: '#EF9A9A' },
};

const ANTECEDENT_TYPE_LABELS: Record<AntecedentType, string> = {
  MEDICAL:            'Médical',
  CHIRURGICAL:        'Chirurgical',
  FAMILIAL:           'Familial',
  GYNECO_OBSTETRIQUE: 'Gynéco-Obstétrique',
  HABITUS:            'Habitudes de vie',
};

const ANTECEDENT_TYPES: AntecedentType[] = [
  'MEDICAL', 'CHIRURGICAL', 'FAMILIAL', 'GYNECO_OBSTETRIQUE', 'HABITUS',
];

function toAge(birthDate: string): number {
  const d = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const EMPTY_FORM: CreatePatientForm = {
  firstName: '',
  lastName: '',
  gender: 'M',
  birthDate: '',
  cin: '',
  phone: '',
  email: '',
  city: '',
  bloodGroup: '',
  notes: '',
  allergies: [],
  antecedents: [],
};

function AllergyRow({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: AllergyEntry;
  index: number;
  onChange: (index: number, next: AllergyEntry) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Input
          value={entry.substance}
          onChange={(e) => onChange(index, { ...entry, substance: e.target.value })}
          placeholder="Ex. Pénicilline, aspirine, iode…"
          style={{ flex: 1, fontSize: 12.5 }}
        />
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="Supprimer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4, borderRadius: 4, lineHeight: 0 }}
        >
          <Close style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['LEGERE', 'MODEREE', 'SEVERE'] as AllergySeverity[]).map((sev) => (
          <button
            key={sev}
            type="button"
            onClick={() => onChange(index, { ...entry, severity: sev })}
            style={{
              fontSize: 11, fontWeight: entry.severity === sev ? 650 : 500,
              padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${entry.severity === sev ? SEVERITY_COLORS[sev].border : 'var(--border)'}`,
              background: entry.severity === sev ? SEVERITY_COLORS[sev].bg : 'transparent',
              color: entry.severity === sev ? SEVERITY_COLORS[sev].color : 'var(--ink-3)',
            }}
          >
            {SEVERITY_LABELS[sev]}
          </button>
        ))}
      </div>
    </div>
  );
}

function AntecedentRow({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: AntecedentEntry;
  index: number;
  onChange: (index: number, next: AntecedentEntry) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px',
      display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select
          value={entry.type}
          onChange={(e) => onChange(index, { ...entry, type: e.target.value as AntecedentType })}
          style={{
            flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 6,
            padding: '0 8px', fontSize: 12.5, fontFamily: 'inherit',
            background: 'var(--surface)', color: 'var(--ink)',
          }}
        >
          {ANTECEDENT_TYPES.map((t) => (
            <option key={t} value={t}>{ANTECEDENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label="Supprimer"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4, borderRadius: 4, lineHeight: 0 }}
        >
          <Close style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <Textarea
        value={entry.description}
        onChange={(e) => onChange(index, { ...entry, description: e.target.value })}
        placeholder="Description…"
        style={{ height: 56, fontSize: 12.5, resize: 'vertical' }}
      />
    </div>
  );
}

function NewPatientPanel({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { create, isPending, error, reset } = useCreatePatient();
  const [form, setForm] = useState<CreatePatientForm>(EMPTY_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  function set<K extends keyof CreatePatientForm>(key: K, value: CreatePatientForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidationError(null);
    reset();
  }

  function addAllergy() {
    set('allergies', [...form.allergies, { substance: '', severity: 'MODEREE' }]);
  }

  function updateAllergy(index: number, next: AllergyEntry) {
    const updated = form.allergies.map((a, i) => (i === index ? next : a));
    set('allergies', updated);
  }

  function removeAllergy(index: number) {
    set('allergies', form.allergies.filter((_, i) => i !== index));
  }

  function addAntecedent() {
    set('antecedents', [...form.antecedents, { type: 'MEDICAL', description: '' }]);
  }

  function updateAntecedent(index: number, next: AntecedentEntry) {
    const updated = form.antecedents.map((a, i) => (i === index ? next : a));
    set('antecedents', updated);
  }

  function removeAntecedent(index: number) {
    set('antecedents', form.antecedents.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidName(form.firstName)) {
      setValidationError('Prénom invalide (lettres uniquement, 2 caractères min).');
      return;
    }
    if (!isValidName(form.lastName)) {
      setValidationError('Nom invalide (lettres uniquement, 2 caractères min).');
      return;
    }
    if (!form.phone.trim()) {
      setValidationError('Le numéro de téléphone est obligatoire.');
      return;
    }
    if (!/^[\d\s+\-().]{6,20}$/.test(form.phone.trim())) {
      setValidationError('Numéro de téléphone invalide.');
      return;
    }
    const created = await create(form).catch(() => null);
    if (created) onCreated(created.id);
  }

  return (
    <Panel
      style={{
        width: 440,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--primary)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Nouveau patient</span>
        <Button variant="ghost" size="sm" iconOnly aria-label="Fermer" onClick={onClose}>
          <Close />
        </Button>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {/* Identity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Prénom *</Lbl>
            <Input value={form.firstName} onChange={(e) => set('firstName', sanitizeName(e.target.value))} placeholder="Mohamed" autoFocus />
          </div>
          <div><Lbl>Nom *</Lbl>
            <Input value={form.lastName} onChange={(e) => set('lastName', sanitizeName(e.target.value))} placeholder="Alami" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Sexe</Lbl>
            <select
              value={form.gender}
              onChange={(e) => set('gender', e.target.value as 'M' | 'F' | 'O')}
              style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <option value="M">Homme</option>
              <option value="F">Femme</option>
              <option value="O">Autre</option>
            </select>
          </div>
          <div><Lbl>Date de naissance</Lbl>
            <Input type="date" value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
          </div>
        </div>

        <div><Lbl>CIN</Lbl>
          <Input value={form.cin} onChange={(e) => set('cin', e.target.value)} placeholder="BE 328451" />
        </div>

        <div><Lbl>Téléphone *</Lbl>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d\s+\-().]/g, '');
              set('phone', v);
            }}
            placeholder="+212 6 61 12 34 56"
            inputMode="tel"
          />
        </div>

        <div><Lbl>Email</Lbl>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="patient@email.ma" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Ville</Lbl>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Casablanca" />
          </div>
          <div><Lbl>Groupe sanguin</Lbl>
            <select
              value={form.bloodGroup}
              onChange={(e) => set('bloodGroup', e.target.value)}
              style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* Allergies */}
        <div>
          <SectionHeader label="Allergies" onAdd={addAllergy} />
          {form.allergies.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>Aucune allergie enregistrée.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.allergies.map((a, i) => (
                <AllergyRow key={i} entry={a} index={i} onChange={updateAllergy} onRemove={removeAllergy} />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* Antécédents */}
        <div>
          <SectionHeader label="Antécédents" onAdd={addAntecedent} />
          {form.antecedents.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>Aucun antécédent enregistré.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {form.antecedents.map((a, i) => (
                <AntecedentRow key={i} entry={a} index={i} onChange={updateAntecedent} onRemove={removeAntecedent} />
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

        {/* Notes */}
        <div><Lbl>Notes libres</Lbl>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Contexte, observations…" style={{ height: 64 }} />
        </div>

        {(validationError ?? error) && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>
            {validationError ?? error}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={isPending} style={{ marginTop: 4 }}>
          {isPending ? 'Enregistrement…' : 'Créer le patient'}
        </Button>
      </form>
    </Panel>
  );
}

export default function PatientsListPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const { patients, total, isLoading, error } = usePatientList(q);

  return (
    <Screen
      active="patients"
      title="Patients"
      sub={isLoading ? 'Chargement…' : `${total} patient${total !== 1 ? 's' : ''}`}
      onNavigate={(id) => {
        const map = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          params: '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 16, padding: '16px 24px' }}>
        {/* Left: search + list */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, gap: 16 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 440 }}>
              <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', pointerEvents: 'none' }}>
                <Search aria-hidden="true" />
              </span>
              <Input
                placeholder="Rechercher par nom, prénom ou CIN…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ paddingLeft: 34 }}
                aria-label="Rechercher un patient"
              />
            </div>
            <Button onClick={() => setShowNew((v) => !v)} style={{ flexShrink: 0 }} aria-pressed={showNew}>
              <Plus /> Nouveau patient
            </Button>
          </div>

          {error && (
            <div style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>
          )}

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {isLoading ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>Chargement…</div>
            ) : patients.length === 0 ? (
              <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
                {q ? 'Aucun patient trouvé.' : 'Aucun patient enregistré.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => navigate(`/patients/${p.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8,
                      background: 'var(--surface)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-alt)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface)')}
                  >
                    <div
                      className="cp-avatar"
                      style={{ width: 36, height: 36, fontSize: 13, flexShrink: 0, background: 'var(--primary)' }}
                      aria-hidden="true"
                    >
                      {p.firstName.charAt(0)}{p.lastName.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {p.firstName} {p.lastName}
                      </div>
                      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 1 }}>
                        {p.gender === 'M' ? 'H' : p.gender === 'F' ? 'F' : p.gender}
                        {p.birthDate ? ` · ${toAge(p.birthDate)} ans` : ''}
                        {p.cin ? ` · ${p.cin}` : ''}
                        {p.city ? ` · ${p.city}` : ''}
                      </div>
                    </div>
                    <span style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                      <Users aria-hidden="true" />
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: new patient panel */}
        {showNew && (
          <NewPatientPanel
            onClose={() => setShowNew(false)}
            onCreated={(id) => {
              setShowNew(false);
              navigate(`/patients/${id}`);
            }}
          />
        )}
      </div>
    </Screen>
  );
}
