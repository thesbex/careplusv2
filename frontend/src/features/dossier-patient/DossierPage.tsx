import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Close } from '@/components/icons';
import { usePatient } from './hooks/usePatient';
import { useUpdatePatient, type UpdatePatientForm } from './hooks/useUpdatePatient';
import { PatientHeader, AllergyStrip } from './components/PatientHeader';
import { DossierTabs, DossierTabPanel } from './components/DossierTabs';
import { TimelinePanel } from './components/TimelinePanel';
import { SummaryPanel } from './components/SummaryPanel';
import type { DossierTab } from './types';
import './dossier-patient.css';

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)', marginBottom: 4 }}>{children}</div>;
}

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

  function set<K extends keyof UpdatePatientForm>(key: K, value: UpdatePatientForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidationError(null);
    setSaved(false);
    reset();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setValidationError('Prénom et nom sont obligatoires.');
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
        width: 400,
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
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Modifier le patient</span>
        <Button variant="ghost" size="sm" iconOnly aria-label="Fermer" onClick={onClose}>
          <Close />
        </Button>
      </div>

      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
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

        <div><Lbl>Notes libres</Lbl>
          <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Contexte, observations…" style={{ height: 72 }} />
        </div>

        {(validationError ?? error) && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{validationError ?? error}</div>
        )}
        {saved && !error && (
          <div style={{ color: 'var(--success, #2E7D32)', fontSize: 12 }}>Modifications enregistrées.</div>
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
  };

  return (
    <Screen
      active="patients"
      title="Patients"
      sub={`${patient.fullName} · Dossier N° ${patient.dossierNo}`}
      onNavigate={(navId) => {
        const map = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          params: '/parametres',
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
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              14 consultations — à venir J5
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="prescr">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              22 prescriptions — à venir J6
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="analyses">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              9 analyses — à venir
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="imagerie">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              3 imageries — à venir
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="docs">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              7 documents — à venir
            </div>
          </DossierTabPanel>

          <DossierTabPanel value="factu">
            <div style={{ padding: '20px 24px', color: 'var(--ink-3)', fontSize: 13 }}>
              14 factures — à venir J7
            </div>
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
