import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Search, Users, Plus, Close } from '@/components/icons';
import { usePatientList } from './hooks/usePatientList';
import { useCreatePatient, type CreatePatientForm } from './hooks/useCreatePatient';

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', marginBottom: 4 }}>{children}</div>;
}

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
};

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

  function set(key: keyof CreatePatientForm, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidationError(null);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setValidationError('Prénom et nom sont obligatoires.');
      return;
    }
    const created = await create(form).catch(() => null);
    if (created) onCreated(created.id);
  }

  return (
    <Panel
      style={{
        width: 400,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        overflow: 'hidden',
        border: '1px solid var(--primary)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Nouveau patient</span>
        <Button variant="ghost" size="sm" iconOnly aria-label="Fermer" onClick={onClose}>
          <Close />
        </Button>
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Prénom *</Lbl>
            <Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} placeholder="Mohamed" autoFocus />
          </div>
          <div><Lbl>Nom *</Lbl>
            <Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} placeholder="Alami" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Sexe</Lbl>
            <select value={form.gender} onChange={(e) => set('gender', e.target.value as 'M' | 'F' | 'O')}
              style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}>
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

        <div><Lbl>Téléphone</Lbl>
          <Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+212 6 61 12 34 56" />
        </div>

        <div><Lbl>Email</Lbl>
          <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="patient@email.ma" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Ville</Lbl>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Casablanca" />
          </div>
          <div><Lbl>Groupe sanguin</Lbl>
            <select value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)}
              style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}>
              <option value="">—</option>
              {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        <div><Lbl>Notes</Lbl>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Antécédents, contexte…" style={{ height: 72 }} />
        </div>

        {(validationError ?? error) && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>
            {validationError ?? error}
          </div>
        )}

        <Button type="submit" disabled={isPending} style={{ marginTop: 4 }}>
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
            <Button
              onClick={() => setShowNew((v) => !v)}
              style={{ flexShrink: 0 }}
              aria-pressed={showNew}
            >
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
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      border: '1px solid var(--border)',
                      borderRadius: 8,
                      background: 'var(--surface)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
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

        {/* Right: new patient panel (slides in) */}
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
