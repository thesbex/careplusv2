import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ChevronLeft, ChevronRight, Close, Plus, Search, Warn } from '@/components/icons';
import { DocumentUploadButton } from '@/components/ui/DocumentUploadButton';
import { PatientAvatar } from '@/components/ui/PatientAvatar';
import { usePatientList, type PatientListItem, type Segment } from './hooks/usePatientList';
import {
  useCreatePatient,
  type CreatePatientForm,
  type AllergyEntry,
  type AntecedentEntry,
  type AllergySeverity,
  type AntecedentType,
} from './hooks/useCreatePatient';
import { useInsurances } from './hooks/useInsurances';
import { useAuthStore } from '@/lib/auth/authStore';
import { api } from '@/lib/api/client';
import { File as FileIcon, Trash } from '@/components/icons';
import { DOCUMENT_TYPE_LABEL, type DocumentType } from './hooks/usePatientDocuments';

const DOC_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';
const DOC_MAX_BYTES = 10 * 1024 * 1024;
const DOC_TYPES: DocumentType[] = [
  'PRESCRIPTION_HISTORIQUE',
  'ANALYSE',
  'IMAGERIE',
  'COMPTE_RENDU',
  'AUTRE',
];

interface PendingDocument {
  file: File;
  type: DocumentType;
  notes: string;
}

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
  tier: 'NORMAL',
  hasMutuelle: false,
  mutuelleInsuranceId: '',
  mutuellePolicyNumber: '',
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
  const [activeTab, setActiveTab] = useState<'personnel' | 'medical'>('personnel');
  const [pendingDocs, setPendingDocs] = useState<PendingDocument[]>([]);
  const [pendingDocType, setPendingDocType] = useState<DocumentType>('PRESCRIPTION_HISTORIQUE');
  const [docError, setDocError] = useState<string | null>(null);
  const [isUploadingDocs, setIsUploadingDocs] = useState(false);
  // QA5-3 — la photo est capturée avant la création du patient ;
  // l'upload est différé jusqu'à ce qu'on ait l'id du nouveau dossier.
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const { insurances } = useInsurances();

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
    // All current required fields (firstName, lastName, phone, birthDate) live
    // on the Personnel tab — bounce there on validation failure so the user
    // sees the offending field, otherwise the error message would point to a
    // hidden field on the Médical tab.
    if (!isValidName(form.firstName)) {
      setActiveTab('personnel');
      setValidationError('Prénom invalide (lettres uniquement, 2 caractères min).');
      return;
    }
    if (!isValidName(form.lastName)) {
      setActiveTab('personnel');
      setValidationError('Nom invalide (lettres uniquement, 2 caractères min).');
      return;
    }
    if (!form.phone.trim()) {
      setActiveTab('personnel');
      setValidationError('Le numéro de téléphone est obligatoire.');
      return;
    }
    if (!/^[\d\s+\-().]{6,20}$/.test(form.phone.trim())) {
      setActiveTab('personnel');
      setValidationError('Numéro de téléphone invalide.');
      return;
    }
    if (!form.birthDate) {
      setActiveTab('personnel');
      setValidationError('La date de naissance est obligatoire.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (form.birthDate > today) {
      setActiveTab('personnel');
      setValidationError('La date de naissance ne peut pas être dans le futur.');
      return;
    }
    const created = await create(form).catch(() => null);
    if (!created) return;

    if (pendingDocs.length > 0 || pendingPhoto) {
      setIsUploadingDocs(true);
      try {
        if (pendingPhoto) {
          const fd = new FormData();
          fd.append('file', pendingPhoto.file);
          await api.put(`/patients/${created.id}/photo`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
        for (const d of pendingDocs) {
          const fd = new FormData();
          fd.append('file', d.file);
          fd.append('type', d.type);
          if (d.notes.trim()) fd.append('notes', d.notes.trim());
          await api.post(`/patients/${created.id}/documents`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      } catch {
        setDocError('Patient créé, mais certains éléments (photo / documents) n\'ont pas pu être téléversés. Reprenez depuis son dossier.');
      } finally {
        setIsUploadingDocs(false);
      }
    }

    onCreated(created.id);
  }

  function setPhotoFromFile(file: File) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) {
      setPhotoError('Format non supporté pour une photo (JPEG, PNG, WebP, HEIC).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('Photo trop volumineuse (max 2 Mo).');
      return;
    }
    setPhotoError(null);
    const previewUrl = URL.createObjectURL(file);
    setPendingPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return { file, previewUrl };
    });
  }

  function clearPhoto() {
    setPendingPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }

  function addPendingDoc(file: File) {
    if (file.size > DOC_MAX_BYTES) {
      setDocError('Fichier trop volumineux (max 10 Mo).');
      return;
    }
    setDocError(null);
    setPendingDocs((arr) => [...arr, { file, type: pendingDocType, notes: '' }]);
  }

  function removePendingDoc(index: number) {
    setPendingDocs((arr) => arr.filter((_, i) => i !== index));
  }

  function updatePendingDocNotes(index: number, notes: string) {
    setPendingDocs((arr) => arr.map((d, i) => (i === index ? { ...d, notes } : d)));
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

      {/* Tabs — Personnel / Médical (QA3-2). Both tabs stay in the same form so
          a submit from either tab posts the full payload. The non-active tab is
          hidden via `hidden` (not unmounted) to keep validation state intact. */}
      <div style={{ display: 'flex', gap: 4, padding: '8px 16px 0' }} role="tablist">
        {(['personnel', 'medical'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={activeTab === t}
            onClick={() => setActiveTab(t)}
            style={{
              flex: 1,
              height: 34,
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              borderRadius: '6px 6px 0 0',
              border: '1px solid var(--border)',
              borderBottom: activeTab === t ? '1px solid var(--surface)' : '1px solid var(--border)',
              background: activeTab === t ? 'var(--surface)' : 'var(--bg-alt)',
              color: activeTab === t ? 'var(--primary)' : 'var(--ink-3)',
              marginBottom: -1,
            }}
          >
            {t === 'personnel' ? 'Informations personnelles' : 'Informations médicales'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border)' }}
      >
        {/* ── Onglet Personnel ───────────────────────────────────────────── */}
        <div hidden={activeTab !== 'personnel'} style={{ display: activeTab === 'personnel' ? 'flex' : 'none', flexDirection: 'column', gap: 14 }}>
          {/* Photo patient (QA5-3) — caméra OU upload. Téléversée après la
              création, donc seulement preview locale ici. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div
              aria-hidden="true"
              style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--bg-alt)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--ink-3)', fontSize: 11, flexShrink: 0,
              }}
            >
              {pendingPhoto ? (
                <img
                  src={pendingPhoto.previewUrl}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                'Photo'
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <DocumentUploadButton
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                uploadLabel="Téléverser"
                cameraLabel="Photographier"
                onFile={setPhotoFromFile}
              />
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                JPEG, PNG, WebP, HEIC — max 2 Mo. Téléversée après création.
              </div>
              {pendingPhoto && (
                <button
                  type="button"
                  onClick={clearPhoto}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-3)', fontSize: 11, padding: '2px 0',
                    fontFamily: 'inherit', textDecoration: 'underline',
                  }}
                >
                  Retirer la photo
                </button>
              )}
              {photoError && (
                <div style={{ fontSize: 12, color: 'var(--danger)' }}>{photoError}</div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

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
            <div><Lbl>Date de naissance *</Lbl>
              <Input
                type="date"
                required
                max={new Date().toISOString().slice(0, 10)}
                value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
              />
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

          <div><Lbl>Ville</Lbl>
            <Input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="Casablanca" />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

          {/* Tier + Mutuelle — stay on Personnel because they drive billing,
              not clinical decisions. */}
          <div>
            <Lbl>Type de patient</Lbl>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['NORMAL', 'PREMIUM'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set('tier', t)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 6,
                    border: `1px solid ${form.tier === t ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.tier === t ? 'var(--primary-soft)' : 'var(--surface)',
                    color: form.tier === t ? 'var(--primary)' : 'var(--ink-2)',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {t === 'PREMIUM' ? '🌟 Premium' : 'Normal'}
                </button>
              ))}
            </div>
            {form.tier === 'PREMIUM' && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
                Une remise automatique sera appliquée à la facturation (configurée dans Paramétrage).
              </div>
            )}
          </div>

          <div>
            <Lbl>A une mutuelle ?</Lbl>
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { v: false, l: 'Non' },
                { v: true, l: 'Oui' },
              ].map((opt) => (
                <button
                  key={String(opt.v)}
                  type="button"
                  onClick={() => set('hasMutuelle', opt.v)}
                  style={{
                    flex: 1,
                    height: 36,
                    borderRadius: 6,
                    border: `1px solid ${form.hasMutuelle === opt.v ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.hasMutuelle === opt.v ? 'var(--primary-soft)' : 'var(--surface)',
                    color: form.hasMutuelle === opt.v ? 'var(--primary)' : 'var(--ink-2)',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                  }}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {form.hasMutuelle && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
              <div>
                <Lbl>Compagnie</Lbl>
                <select
                  value={form.mutuelleInsuranceId}
                  onChange={(e) => set('mutuelleInsuranceId', e.target.value)}
                  style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
                >
                  <option value="">— Sélectionner —</option>
                  {insurances.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Lbl>N° de police</Lbl>
                <Input
                  value={form.mutuellePolicyNumber}
                  onChange={(e) => set('mutuellePolicyNumber', e.target.value)}
                  placeholder="—"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Onglet Médical ─────────────────────────────────────────────── */}
        <div hidden={activeTab !== 'medical'} style={{ display: activeTab === 'medical' ? 'flex' : 'none', flexDirection: 'column', gap: 14 }}>
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

          {/* Notes médicales */}
          <div><Lbl>Notes médicales libres</Lbl>
            <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Contexte, observations…" style={{ height: 80 }} />
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

          {/* Documents historiques (anciennes prescriptions, analyses, radio, comptes rendus) */}
          <div>
            <Lbl>Documents historiques</Lbl>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: -2, marginBottom: 8 }}>
              Anciennes prescriptions, résultats d'analyses, imagerie, comptes rendus.
              Téléversés automatiquement après création du patient.
            </div>
            <div
              style={{
                display: 'flex', flexDirection: 'column', gap: 8,
                padding: 12,
                border: '1px dashed var(--border)', borderRadius: 8,
                background: 'var(--bg-alt)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={pendingDocType}
                  onChange={(e) => setPendingDocType(e.target.value as DocumentType)}
                  aria-label="Type de document"
                  style={{
                    height: 32, fontSize: 12.5, fontFamily: 'inherit',
                    border: '1px solid var(--border)', borderRadius: 6,
                    padding: '0 8px', background: 'var(--surface)',
                  }}
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>
                  ))}
                </select>
                <DocumentUploadButton
                  accept={DOC_ACCEPT}
                  uploadLabel="Ajouter un fichier"
                  onFile={(f) => addPendingDoc(f)}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                PDF, JPEG, PNG, WebP, HEIC — max 10 Mo par fichier. « Photographier » ouvre la caméra directement.
              </div>
              {docError && (
                <div style={{ fontSize: 12, color: 'var(--danger)' }}>{docError}</div>
              )}
            </div>

            {pendingDocs.length > 0 && (
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 0, marginTop: 8, listStyle: 'none' }}>
                {pendingDocs.map((d, i) => (
                  <li
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px',
                      border: '1px solid var(--border)', borderRadius: 8,
                      background: 'var(--surface)',
                    }}
                  >
                    <FileIcon style={{ width: 16, height: 16, color: 'var(--ink-3)', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.file.name}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                        {DOCUMENT_TYPE_LABEL[d.type]} · {(d.file.size / 1024).toFixed(0)} Ko
                      </span>
                      <input
                        type="text"
                        value={d.notes}
                        onChange={(e) => updatePendingDocNotes(i, e.target.value)}
                        placeholder="Note (optionnelle)"
                        style={{
                          height: 26, fontSize: 11.5,
                          border: '1px solid var(--border)', borderRadius: 4,
                          padding: '0 6px', fontFamily: 'inherit', background: 'var(--surface)',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removePendingDoc(i)}
                      aria-label={`Retirer ${d.file.name}`}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--ink-3)', padding: 4, borderRadius: 4, lineHeight: 0,
                      }}
                    >
                      <Trash style={{ width: 14, height: 14 }} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {(validationError ?? error) && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>
            {validationError ?? error}
          </div>
        )}

        <Button type="submit" variant="primary" disabled={isPending || isUploadingDocs} style={{ marginTop: 4 }}>
          {isUploadingDocs
            ? 'Téléversement des documents…'
            : isPending
            ? 'Enregistrement…'
            : 'Créer le patient'}
        </Button>
      </form>
    </Panel>
  );
}

// ─── Segmented control + filter chips + dense table ──────────────────────
// Design source: design/prototype/screens/liste-patients.jsx (05a). Layout is
// stacked vertically inside <Screen> with overflow:hidden so the table scrolls
// independently — the toolbar rows stay pinned at the top.
const SEG_LABELS: Record<Segment, string> = {
  tous: 'Tous',
  recent: 'Vus récemment',
  chroniques: 'Patients chroniques',
  nouveaux: 'Nouveaux (30j)',
};

const SEGMENTS: Segment[] = ['tous', 'recent', 'chroniques', 'nouveaux'];

const PAGE_SIZE = 20;

const AVATAR_PALETTE: readonly string[] = ['#1E5AA8', '#2A7CE7', '#6B6B6B', '#3F7A3A', '#B8500C'];
function avatarColor(id: string): string {
  const idx = id.charCodeAt(id.length - 1) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] ?? '#2A7CE7';
}

function initialsOf(p: PatientListItem): string {
  return `${p.firstName.charAt(0)}${p.lastName.charAt(0)}`.toUpperCase();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
}

function relativeDays(iso: string | null | undefined): string {
  if (!iso) return 'Nouveau';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return '';
  if (days < 1) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 14) return `il y a ${days} j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 9) return `il y a ${weeks} sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months} mois`;
  return '';
}

/** KPI tile cliquable — sert ET de carte d'aperçu ET de filtre rapide (active si segment courant). */
function KpiTile({
  label,
  value,
  sub,
  active,
  onClick,
}: {
  label: string;
  value: number | string;
  sub?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1, minWidth: 0, textAlign: 'left',
        background: active ? 'var(--ds2-navy-soft, var(--primary-soft))' : 'var(--surface)',
        border: `1px solid ${active ? 'var(--ds2-navy, var(--primary))' : 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        padding: '12px 14px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 0.12s, background 0.12s',
      }}
    >
      <div style={{
        fontSize: 10.5, color: active ? 'var(--ds2-navy)' : 'var(--ink-3)',
        fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</div>
      <div className="tnum" style={{
        fontSize: 22, fontWeight: 700,
        color: active ? 'var(--ds2-navy)' : 'var(--ds2-ink, var(--ink))',
        letterSpacing: '-0.02em', marginTop: 2,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</div>}
    </button>
  );
}

const ROW_GRID = '1.4fr 100px 150px 1.3fr 150px 170px';

function PatientRow({
  p,
  selected,
  onSelect,
  onOpen,
}: {
  p: PatientListItem;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      onDoubleClick={onOpen}
      style={{
        display: 'grid', gridTemplateColumns: ROW_GRID,
        padding: '12px 16px', gap: 14, alignItems: 'center',
        borderBottom: '1px solid var(--border-soft)',
        background: selected ? 'var(--primary-soft)' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.08s',
      }}
    >
      {/* Patient */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <PatientAvatar
          initials={initialsOf(p)}
          documentId={p.photoDocumentId ?? null}
          size="md"
          bg={avatarColor(p.id)}
          style={{ flexShrink: 0 }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              style={{
                fontWeight: 600, fontSize: 13.5, color: 'var(--ink)',
                background: 'none', border: 0, padding: 0, fontFamily: 'inherit', cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {p.tier === 'PREMIUM' && (
                <span aria-label="Patient Premium" title="Patient Premium" style={{ marginRight: 4 }}>🌟</span>
              )}
              {p.firstName} {p.lastName}
            </button>
            {p.allergy && (
              <span
                className="pill allergy"
                title="Allergie connue"
                aria-label="Allergie connue"
                style={{ paddingInline: 4 }}
              >
                <Warn />
              </span>
            )}
            {p.pregnant && (
              <span className="pill" style={{ background: '#FDE6EE', color: '#9A2A52' }}>Grossesse</span>
            )}
            {p.isNew && (
              <span className="pill" style={{ background: 'var(--primary-soft)', color: 'var(--primary)' }}>Nouveau</span>
            )}
          </div>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 2 }}>
            {p.id.slice(0, 8)} · {p.cin ? `CIN ${p.cin}` : 'CIN —'}
          </div>
        </div>
      </div>

      {/* Démo */}
      <div style={{ fontSize: 12.5 }}>
        <div className="tnum" style={{ fontWeight: 600 }}>
          {p.birthDate ? `${toAge(p.birthDate)} ans` : '—'}
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
          {p.gender === 'M' ? 'Homme' : p.gender === 'F' ? 'Femme' : '—'}
        </div>
      </div>

      {/* Téléphone */}
      <div className="tnum" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
        {p.phone || <span style={{ color: 'var(--ink-4)' }}>—</span>}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {!p.tags || p.tags.length === 0
          ? <span style={{ fontSize: 11.5, color: 'var(--ink-4)' }}>—</span>
          : p.tags.map((t) => <span key={t} className="pill">{t}</span>)}
      </div>

      {/* Dernière visite */}
      <div className="tnum" style={{ fontSize: 12.5 }}>
        <div style={{ fontWeight: 550, color: p.lastVisitAt ? 'var(--ink-2)' : 'var(--ink-4)' }}>
          {formatDate(p.lastVisitAt)}
        </div>
        {p.lastVisitAt && (
          <div style={{ fontSize: 10.5, color: 'var(--ink-3)', marginTop: 1 }}>
            {relativeDays(p.lastVisitAt)}
          </div>
        )}
      </div>

      {/* Prochain RDV */}
      <div className="tnum" style={{ fontSize: 12.5 }}>
        {p.nextAppointmentAt
          ? <span style={{ fontWeight: 550, color: 'var(--primary)' }}>{formatDateTime(p.nextAppointmentAt)}</span>
          : <span style={{ color: 'var(--ink-4)' }}>—</span>}
      </div>
    </div>
  );
}

export default function PatientsListPage() {
  const navigate = useNavigate();
  const [seg, setSeg] = useState<Segment>('tous');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Refonte 2026-05-28 : recherche inline + filtres Sexe + tranche d'âge
  // (déjà supportés par l'API mais sans UI). Search debouncé pour ne pas
  // spam la API à chaque frappe.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'' | 'M' | 'F' | 'O'>('');
  const [ageRange, setAgeRange] = useState<'' | 'CHILD' | 'ADULT' | 'SENIOR'>('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Mapping tranche d'âge → bornes (ageMin/ageMax côté API).
  const ageBounds: { min?: number; max?: number } = (() => {
    if (ageRange === 'CHILD') return { max: 14 };
    if (ageRange === 'ADULT') return { min: 15, max: 64 };
    if (ageRange === 'SENIOR') return { min: 65 };
    return {};
  })();

  const { patients, total, totalPages, counts, isLoading, error } = usePatientList({
    segment: seg,
    page,
    size: PAGE_SIZE,
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    ...(genderFilter ? { gender: genderFilter } : {}),
    ...(ageBounds.min != null ? { ageMin: ageBounds.min } : {}),
    ...(ageBounds.max != null ? { ageMax: ageBounds.max } : {}),
  });

  // Reset page on filter change pour éviter d'atterrir sur une page vide.
  useEffect(() => {
    setPage(0);
  }, [seg, debouncedSearch, genderFilter, ageRange]);

  const hasActiveFilter = !!debouncedSearch.trim() || !!genderFilter || !!ageRange;
  function resetFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setGenderFilter('');
    setAgeRange('');
  }

  // QA3-3 v1 — back-compat gate on PATIENT_CREATE.
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canCreatePatient = userPerms == null || userPerms.includes('PATIENT_CREATE');

  const segItems = useMemo(
    () => SEGMENTS.map((id) => ({ id, label: SEG_LABELS[id], count: counts[id] })),
    [counts],
  );

  const topRight = (
    <>
      {canCreatePatient && (
        <Button
          className="cp-ds2-primary"
          type="button"
          onClick={() => setShowNew((v) => !v)}
          aria-pressed={showNew}
        >
          <Plus /> Nouveau patient
        </Button>
      )}
    </>
  );

  return (
    <Screen
      active="patients"
      title="Patients"
      sub={`Annuaire du cabinet · ${counts.tous} dossier${counts.tous !== 1 ? 's' : ''}`}
      topbarRight={topRight}
    >
      <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* KPI tiles (cliquables = segments) — refonte 2026-05-28 iso DS2 */}
        <div style={{ padding: '16px 20px 0', display: 'flex', gap: 12, flexShrink: 0 }}>
          {segItems.map((s) => (
            <KpiTile
              key={s.id}
              label={s.label}
              value={s.count}
              active={seg === s.id}
              onClick={() => setSeg(s.id)}
              {...(s.id === 'nouveaux'
                ? { sub: 'créés ces 30 derniers jours' }
                : s.id === 'chroniques'
                ? { sub: 'maladies chroniques' }
                : s.id === 'recent'
                ? { sub: 'vus < 30 jours' }
                : { sub: 'dossiers du cabinet' })}
            />
          ))}
        </div>

        {/* Barre filtres fonctionnels : recherche + sexe + tranche d'âge */}
        <div
          style={{
            padding: '12px 20px', display: 'grid', flexShrink: 0,
            gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, alignItems: 'end',
            background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Rechercher
            </span>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--ink-4)', display: 'inline-flex', alignItems: 'center', pointerEvents: 'none',
              }}>
                <Search />
              </span>
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Nom, prénom, CIN, téléphone…"
                aria-label="Rechercher un patient"
                style={{
                  width: '100%', height: 34, padding: '0 12px 0 30px',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
                }}
              />
            </div>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Sexe
            </span>
            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as '' | 'M' | 'F' | 'O')}
              aria-label="Filtrer par sexe"
              style={{
                height: 34, padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 8,
                fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
              }}
            >
              <option value="">Tous</option>
              <option value="M">Homme</option>
              <option value="F">Femme</option>
              <option value="O">Autre</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 11 }}>
            <span style={{ color: 'var(--ink-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Tranche d'âge
            </span>
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value as '' | 'CHILD' | 'ADULT' | 'SENIOR')}
              aria-label="Filtrer par tranche d'âge"
              style={{
                height: 34, padding: '0 10px',
                border: '1px solid var(--border)', borderRadius: 8,
                fontFamily: 'inherit', fontSize: 12.5, background: 'var(--surface)',
              }}
            >
              <option value="">Toutes</option>
              <option value="CHILD">Enfant (0-14)</option>
              <option value="ADULT">Adulte (15-64)</option>
              <option value="SENIOR">Senior (65+)</option>
            </select>
          </label>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={resetFilters}
              style={{
                height: 34, padding: '0 14px',
                background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', color: 'var(--primary)',
              }}
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Table */}
        <div className="scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
          <div style={{ padding: '0 20px' }}>
            <div className="panel" style={{ margin: '14px 0', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: ROW_GRID,
                  padding: '10px 16px', gap: 14,
                  fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
                  color: 'var(--ink-3)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)',
                }}
              >
                <span>Patient</span>
                <span>Démo.</span>
                <span>Téléphone</span>
                <span>Tags · Antécédents</span>
                <span>Dernière visite</span>
                <span>Prochain RDV</span>
              </div>

              {isLoading ? (
                <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--ink-3)' }}>Chargement…</div>
              ) : error ? (
                <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--danger)' }}>{error}</div>
              ) : patients.length === 0 ? (
                <div style={{ padding: '24px 16px', fontSize: 13, color: 'var(--ink-3)' }}>
                  Aucun patient ne correspond à ce filtre.
                </div>
              ) : (
                patients.map((p) => (
                  <PatientRow
                    key={p.id}
                    p={p}
                    selected={selected === p.id}
                    onSelect={() => setSelected(p.id)}
                    onOpen={() => navigate(`/patients/${p.id}`)}
                  />
                ))
              )}
            </div>

            <div
              style={{
                padding: '8px 4px 18px', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', fontSize: 11.5, color: 'var(--ink-3)',
              }}
            >
              <span>
                Affichage de <strong style={{ color: 'var(--ink-2)' }}>{patients.length}</strong> patient{patients.length !== 1 ? 's' : ''} sur {total}
              </span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  className="btn sm ghost"
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Page précédente"
                >
                  <ChevronLeft />
                </button>
                <span className="tnum">
                  Page {page + 1} / {Math.max(1, totalPages)}
                </span>
                <button
                  className="btn sm ghost"
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                  aria-label="Page suivante"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {showNew && (
        <div style={{ padding: 16, display: 'flex', minWidth: 0 }}>
          <NewPatientPanel
            onClose={() => setShowNew(false)}
            onCreated={(id) => {
              setShowNew(false);
              navigate(`/patients/${id}`);
            }}
          />
        </div>
      )}
      </div>
    </Screen>
  );
}
