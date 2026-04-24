import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Close, Plus } from '@/components/icons';
import { usePatient } from './hooks/usePatient';
import {
  useUpdatePatient,
  type UpdatePatientForm,
  type AllergySeverity,
  type AntecedentType,
} from './hooks/useUpdatePatient';
import { PatientHeader, AllergyStrip } from './components/PatientHeader';
import { DossierTabs, DossierTabPanel } from './components/DossierTabs';
import { TimelinePanel } from './components/TimelinePanel';
import { SummaryPanel } from './components/SummaryPanel';
import type { DossierTab } from './types';
import './dossier-patient.css';

// ── Shared helpers ────────────────────────────────────────────────────────────

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
  LEGERE: 'Légère', MODEREE: 'Modérée', SEVERE: 'Sévère',
};

const SEVERITY_COLORS: Record<AllergySeverity, { bg: string; color: string; border: string }> = {
  LEGERE:  { bg: 'var(--green-soft, #E8F5E9)', color: '#2E7D32', border: '#A5D6A7' },
  MODEREE: { bg: 'var(--amber-soft, #FFF8E1)', color: '#E65100', border: '#FFCC80' },
  SEVERE:  { bg: 'var(--danger-soft, #FFEBEE)', color: 'var(--danger)', border: '#EF9A9A' },
};

const ANTECEDENT_TYPE_LABELS: Record<AntecedentType, string> = {
  MEDICAL: 'Médical', CHIRURGICAL: 'Chirurgical', FAMILIAL: 'Familial',
  GYNECO_OBSTETRIQUE: 'Gynéco-Obstétrique', HABITUS: 'Habitudes de vie',
};

const ANTECEDENT_TYPES: AntecedentType[] = [
  'MEDICAL', 'CHIRURGICAL', 'FAMILIAL', 'GYNECO_OBSTETRIQUE', 'HABITUS',
];

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Supprimer"
      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-3)', padding: 4, borderRadius: 4, lineHeight: 0, flexShrink: 0 }}
    >
      <Close style={{ width: 13, height: 13 }} />
    </button>
  );
}

// ── Edit panel ────────────────────────────────────────────────────────────────

function EditPatientPanel({
  patientId,
  initial,
  onClose,
}: {
  patientId: string;
  initial: UpdatePatientForm;
  onClose: () => void;
}) {
  const { update, isPending, error, reset } = useUpdatePatient(patientId);
  const [form, setForm] = useState<UpdatePatientForm>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof UpdatePatientForm>(key: K, value: UpdatePatientForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidationError(null);
    setSaved(false);
    reset();
  }

  // ── Existing allergy remove ───────────────────────────────────────
  function removeExistingAllergy(id: string) {
    setForm((f) => ({
      ...f,
      existingAllergies: f.existingAllergies.filter((a) => a.id !== id),
      deletedAllergyIds: [...f.deletedAllergyIds, id],
    }));
  }

  // ── New allergy ───────────────────────────────────────────────────
  function addNewAllergy() {
    setField('newAllergies', [...form.newAllergies, { substance: '', severity: 'MODEREE' }]);
  }
  function updateNewAllergy(i: number, next: { substance: string; severity: AllergySeverity }) {
    setField('newAllergies', form.newAllergies.map((a, idx) => (idx === i ? next : a)));
  }
  function removeNewAllergy(i: number) {
    setField('newAllergies', form.newAllergies.filter((_, idx) => idx !== i));
  }

  // ── Existing antécédent remove ────────────────────────────────────
  function removeExistingAntecedent(id: string) {
    setForm((f) => ({
      ...f,
      existingAntecedents: f.existingAntecedents.filter((a) => a.id !== id),
      deletedAntecedentIds: [...f.deletedAntecedentIds, id],
    }));
  }

  // ── New antécédent ────────────────────────────────────────────────
  function addNewAntecedent() {
    setField('newAntecedents', [...form.newAntecedents, { type: 'MEDICAL', description: '' }]);
  }
  function updateNewAntecedent(i: number, next: { type: AntecedentType; description: string }) {
    setField('newAntecedents', form.newAntecedents.map((a, idx) => (idx === i ? next : a)));
  }
  function removeNewAntecedent(i: number) {
    setField('newAntecedents', form.newAntecedents.filter((_, idx) => idx !== i));
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
    await update(form).catch(() => null);
    if (!error) setSaved(true);
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
        position: 'absolute',
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 10,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Modifier le patient</span>
        <Button variant="ghost" size="sm" iconOnly aria-label="Fermer" onClick={onClose}>
          <Close />
        </Button>
      </div>

      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        {/* ── Identité ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Prénom *</Lbl>
            <Input value={form.firstName} onChange={(e) => setField('firstName', sanitizeName(e.target.value))} autoFocus />
          </div>
          <div><Lbl>Nom *</Lbl>
            <Input value={form.lastName} onChange={(e) => setField('lastName', sanitizeName(e.target.value))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Sexe</Lbl>
            <select
              value={form.gender}
              onChange={(e) => setField('gender', e.target.value as 'M' | 'F' | 'O')}
              style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <option value="M">Homme</option>
              <option value="F">Femme</option>
              <option value="O">Autre</option>
            </select>
          </div>
          <div><Lbl>Date de naissance</Lbl>
            <Input type="date" value={form.birthDate} onChange={(e) => setField('birthDate', e.target.value)} />
          </div>
        </div>

        <div><Lbl>CIN</Lbl>
          <Input value={form.cin} onChange={(e) => setField('cin', e.target.value)} placeholder="BE 328451" />
        </div>

        <div><Lbl>Téléphone *</Lbl>
          <Input
            type="tel"
            value={form.phone}
            onChange={(e) => setField('phone', e.target.value.replace(/[^\d\s+\-().]/g, ''))}
            placeholder="+212 6 61 12 34 56"
            inputMode="tel"
          />
        </div>

        <div><Lbl>Email</Lbl>
          <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="patient@email.ma" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><Lbl>Ville</Lbl>
            <Input value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="Casablanca" />
          </div>
          <div><Lbl>Groupe sanguin</Lbl>
            <select
              value={form.bloodGroup}
              onChange={(e) => setField('bloodGroup', e.target.value)}
              style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── Allergies ─────────────────────────────────────────────── */}
        <div>
          <SectionHeader label="Allergies" onAdd={addNewAllergy} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Existing */}
            {form.existingAllergies.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 550 }}>{a.substance}</span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 10,
                  background: SEVERITY_COLORS[a.severity].bg,
                  color: SEVERITY_COLORS[a.severity].color,
                  border: `1px solid ${SEVERITY_COLORS[a.severity].border}`,
                }}>
                  {SEVERITY_LABELS[a.severity]}
                </span>
                <RemoveBtn onClick={() => removeExistingAllergy(a.id)} />
              </div>
            ))}
            {/* New */}
            {form.newAllergies.map((a, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Input
                    value={a.substance}
                    onChange={(e) => updateNewAllergy(i, { ...a, substance: e.target.value })}
                    placeholder="Ex. Pénicilline, iode…"
                    style={{ flex: 1, fontSize: 12.5 }}
                  />
                  <RemoveBtn onClick={() => removeNewAllergy(i)} />
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['LEGERE', 'MODEREE', 'SEVERE'] as AllergySeverity[]).map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => updateNewAllergy(i, { ...a, severity: sev })}
                      style={{
                        fontSize: 11, fontWeight: a.severity === sev ? 650 : 500,
                        padding: '3px 10px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                        border: `1px solid ${a.severity === sev ? SEVERITY_COLORS[sev].border : 'var(--border)'}`,
                        background: a.severity === sev ? SEVERITY_COLORS[sev].bg : 'transparent',
                        color: a.severity === sev ? SEVERITY_COLORS[sev].color : 'var(--ink-3)',
                      }}
                    >
                      {SEVERITY_LABELS[sev]}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {form.existingAllergies.length === 0 && form.newAllergies.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>Aucune allergie.</div>
            )}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── Antécédents ───────────────────────────────────────────── */}
        <div>
          <SectionHeader label="Antécédents" onAdd={addNewAntecedent} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Existing */}
            {form.existingAntecedents.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 650, color: 'var(--primary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {ANTECEDENT_TYPE_LABELS[a.type]}
                  </div>
                  <div style={{ fontSize: 12.5 }}>{a.description}</div>
                </div>
                <RemoveBtn onClick={() => removeExistingAntecedent(a.id)} />
              </div>
            ))}
            {/* New */}
            {form.newAntecedents.map((a, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--surface)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <select
                    value={a.type}
                    onChange={(e) => updateNewAntecedent(i, { ...a, type: e.target.value as AntecedentType })}
                    style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 6, padding: '0 8px', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
                  >
                    {ANTECEDENT_TYPES.map((t) => <option key={t} value={t}>{ANTECEDENT_TYPE_LABELS[t]}</option>)}
                  </select>
                  <RemoveBtn onClick={() => removeNewAntecedent(i)} />
                </div>
                <Textarea
                  value={a.description}
                  onChange={(e) => updateNewAntecedent(i, { ...a, description: e.target.value })}
                  placeholder="Description…"
                  style={{ height: 56, fontSize: 12.5, resize: 'vertical' }}
                />
              </div>
            ))}
            {form.existingAntecedents.length === 0 && form.newAntecedents.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>Aucun antécédent.</div>
            )}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── Notes libres ──────────────────────────────────────────── */}
        <div><Lbl>Notes libres</Lbl>
          <Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder="Contexte, observations…" style={{ height: 64 }} />
        </div>

        {(validationError ?? error) && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{validationError ?? error}</div>
        )}
        {saved && !error && (
          <div style={{ color: '#2E7D32', fontSize: 12 }}>Modifications enregistrées.</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="submit" variant="primary" disabled={isPending} style={{ flex: 1 }}>
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        </div>
      </form>
    </Panel>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DossierPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { patient, raw, isLoading, error } = usePatient(id);
  const [tab, setTab] = useState<DossierTab>('timeline');
  const [showEdit, setShowEdit] = useState(false);

  if (isLoading) {
    return (
      <Screen active="patients" title="Patients" sub="Chargement…" onNavigate={() => {}}>
        <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>Chargement du dossier…</div>
      </Screen>
    );
  }

  if (error || !patient || !raw) {
    return (
      <Screen active="patients" title="Patients" sub="Erreur" onNavigate={() => {}}>
        <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>
          {error ?? 'Patient introuvable.'}
        </div>
      </Screen>
    );
  }

  const editInitial: UpdatePatientForm = {
    firstName: raw.firstName,
    lastName: raw.lastName,
    gender: (raw.gender as 'M' | 'F' | 'O') ?? 'M',
    birthDate: raw.birthDate ?? '',
    cin: raw.cin ?? '',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    city: '',
    bloodGroup: raw.bloodGroup ?? '',
    notes: '',
    existingAllergies: raw.allergies.map((a) => ({
      id: a.id,
      substance: a.substance,
      severity: (a.severity as AllergySeverity) ?? 'MODEREE',
    })),
    deletedAllergyIds: [],
    newAllergies: [],
    existingAntecedents: raw.antecedents.map((a) => ({
      id: a.id,
      type: (a.type as AntecedentType) ?? 'MEDICAL',
      description: a.description,
    })),
    deletedAntecedentIds: [],
    newAntecedents: [],
  };

  return (
    <Screen
      active="patients"
      title="Patients"
      sub={`${patient.fullName} · Dossier N° ${patient.dossierNo}`}
      onNavigate={(navId) => {
        const map = {
          agenda: '/agenda', patients: '/patients', salle: '/salle',
          consult: '/consultations', factu: '/facturation', params: '/parametres',
        } as const;
        navigate(map[navId]);
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
        <PatientHeader patient={patient} onEdit={() => setShowEdit((v) => !v)} />
        <AllergyStrip patient={patient} />

        <DossierTabs value={tab} onValueChange={setTab}>
          <DossierTabPanel value="timeline">
            <div className="dp-content">
              <TimelinePanel events={patient.timeline} />
              <SummaryPanel patient={patient} />
            </div>
          </DossierTabPanel>
          <DossierTabPanel value="consults">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>14 consultations — à venir J5</div>
          </DossierTabPanel>
          <DossierTabPanel value="prescr">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>22 prescriptions — à venir J6</div>
          </DossierTabPanel>
          <DossierTabPanel value="analyses">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>9 analyses — à venir</div>
          </DossierTabPanel>
          <DossierTabPanel value="imagerie">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>3 imageries — à venir</div>
          </DossierTabPanel>
          <DossierTabPanel value="docs">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>7 documents — à venir</div>
          </DossierTabPanel>
          <DossierTabPanel value="factu">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>14 factures — à venir J7</div>
          </DossierTabPanel>
        </DossierTabs>

        {showEdit && (
          <EditPatientPanel
            patientId={raw.id}
            initial={editInitial}
            onClose={() => setShowEdit(false)}
          />
        )}
      </div>
    </Screen>
  );
}
