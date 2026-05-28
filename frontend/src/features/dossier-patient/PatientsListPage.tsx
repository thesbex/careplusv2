import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ChevronDown, ChevronLeft, ChevronRight, Close, Filter as FilterIcon, Plus } from '@/components/icons';
import './patients-list.css';
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

// ─── Page liste patients — refonte 2026-05-28 iso nouvelle maquette user
// (KPI bar + multi-select + bulk actions + preview panel à droite).
// Segments derivés client-side au-dessus de l'API existante (qui ne supporte
// que tous/recent/chroniques/nouveaux). « Actifs » = tous, « Sans RDV · 6m »
// = sous-filtre client, « Pédiatrie » = ageMax=14.

type ExtSegment = 'tous' | 'actifs' | 'nouveaux' | 'chroniques' | 'sans-rdv' | 'pediatrie';

// Dot retiré — les pastilles colorées vivent dans patients-list.css (.kpi .dot
// et .drail-stat .dot) ; usage inline via <span className="dot" />.

// KpiTile retiré — le nouveau layout iso maquette utilise les classes .kpi
// inline dans le render (cf. .kpi-strip). Dot reste exposé pour les chips de
// statut (StatusChip déjà utilisé) et le drail.

// Iso maquette `liste-patients.jsx` : palette vert/saphir/gris/vert-foncé/orange.
const AVATAR_PALETTE: readonly string[] = ['#0E5B3E', '#1E4DAB', '#6B6B6B', '#3F7A3A', '#B8500C'];
function avatarColor(id: string): string {
  const idx = id.charCodeAt(id.length - 1) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx] ?? '#1E4DAB';
}

/**
 * Initiales iso maquette : 2 premières lettres des 2 premiers mots du nom
 * complet (« Fatima Zahra Lahlou » → « FZ »), pas firstName[0]+lastName[0]
 * qui donne des combinaisons étranges sur les noms composés.
 */
function initialsOf(p: PatientListItem): string {
  const full = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  const parts = full.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((w) => w.charAt(0)).join('').toUpperCase() || '?';
}

/**
 * ID humain iso maquette « PT-00482 ». On dérive de l'UUID (6 derniers
 * caractères hex, uppercase) pour avoir un identifiant stable et court.
 * Le préfixe « PT- » reproduit le format design — pas de notion de
 * numéro séquentiel côté backend en v1.
 */
function humanId(uuid: string): string {
  return `PT-${uuid.slice(-6).toUpperCase()}`;
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

// relativeDays retiré (utilisé seulement par l'ancien layout). Si besoin
// dans la nouvelle preview panel, on le recodera localement.

/**
 * Filter chip iso maquette `design/refresh/project/screens/liste-patients.jsx`.
 * Pill rounded avec label + value + ChevronDown. Branché à un petit popover
 * d'options (au clic) : sélectionner une option appelle `onChange(value)`.
 * `muted` = grise le texte (état « pas encore choisi »).
 */
function FilterChip({
  label,
  value,
  options,
  onChange,
  muted,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange?: (next: string) => void;
  muted?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        onClick={() => onChange && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          height: 28, padding: '0 10px',
          border: '1px solid var(--border)', borderRadius: 14,
          background: 'var(--surface)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 11.5, cursor: onChange ? 'pointer' : 'default',
          color: muted ? 'var(--ink-3)' : 'var(--ink)',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{label}</span>
        <span style={{ fontWeight: 600 }}>{value}</span>
        <ChevronDown />
      </button>
      {open && onChange && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: '100%', left: 0, marginTop: 4,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            minWidth: 180, padding: 4, zIndex: 50,
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={value === opt.label}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 10px', background: 'transparent', border: 'none',
                cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
                color: 'var(--ink)', borderRadius: 6,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ROW_GRID + StatusChip retirés — la nouvelle PatientRow utilise les classes
// .ptr / .ppill du nouveau patients-list.css (iso maquette).

/** Dérive le statut visible d'un patient à partir des flags backend disponibles. */
function statusOf(p: PatientListItem): 'en-consult' | 'en-attente' | 'termine' | 'actif' | 'inactif' {
  // Heuristique pour faute de status réel dans PatientListItem :
  // - nextAppointment dans < 1h → en-attente
  // - lastVisitAt récent (< 24h) → termine
  // - sinon actif (et inactif si plus de 12 mois sans visite)
  const now = Date.now();
  if (p.nextAppointmentAt) {
    const dt = new Date(p.nextAppointmentAt).getTime();
    if (Math.abs(dt - now) < 60 * 60 * 1000) return 'en-attente';
  }
  if (p.lastVisitAt) {
    const dt = new Date(p.lastVisitAt).getTime();
    if (now - dt < 24 * 60 * 60 * 1000) return 'termine';
    if (now - dt > 365 * 24 * 60 * 60 * 1000) return 'inactif';
  }
  return 'actif';
}

// (fichier scratch — sera concaténé puis supprimé)
/* eslint-disable */

// ─── PatientRow iso maquette (.ptr / .ck / .pcell-who) ───────────────────
function PatientRow({
  p,
  selected,
  checked,
  onCheck,
  onSelect,
  onOpen,
  practitionerLabel,
}: {
  p: PatientListItem;
  selected: boolean;
  checked: boolean;
  onCheck: (next: boolean) => void;
  onSelect: () => void;
  onOpen: () => void;
  practitionerLabel: string;
}) {
  const st = statusOf(p);
  // 2 tags max + extra "more" si plus, allergie en pill spécifique
  const tags = (p.tags ?? []).slice(0, 2);
  const extra = Math.max(0, (p.tags?.length ?? 0) - 2);
  void practitionerLabel; // (réservé pour usages futurs — tooltip / filtre médecin)
  return (
    <div
      className={`ptr ${selected ? 'preview' : ''}`}
      onClick={onSelect}
      onDoubleClick={onOpen}
    >
      {/* Checkbox */}
      <span
        className={`ck ${checked ? 'on' : ''}`}
        onClick={(e) => { e.stopPropagation(); onCheck(!checked); }}
        role="checkbox"
        aria-checked={checked}
        aria-label={`Sélectionner ${p.firstName} ${p.lastName}`}
      >
        {checked && '✓'}
      </span>

      {/* Patient (avatar + name + sub) */}
      <div className="pcell-who">
        <div className="pav" style={{ background: avatarColor(p.id) }}>
          {p.photoDocumentId ? (
            <PatientAvatar
              initials={initialsOf(p)}
              documentId={p.photoDocumentId}
              size="md"
              bg={avatarColor(p.id)}
            />
          ) : (
            <span>{initialsOf(p)}</span>
          )}
        </div>
        <div className="nm">
          <div className="n" title={`${p.firstName} ${p.lastName}`}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              style={{ background: 'none', border: 0, padding: 0, font: 'inherit', cursor: 'pointer', color: 'inherit', textAlign: 'left' }}
            >
              {p.firstName} {p.lastName}
            </button>
            {p.chronic && <span className="flag">Chronique</span>}
          </div>
          <div className="s">
            <span className="dossier">{humanId(p.id)}</span>
            <span className="sep">·</span>
            <span>{p.gender === 'M' ? 'H' : p.gender === 'F' ? 'F' : 'M'} · {p.birthDate ? `${toAge(p.birthDate)} ans` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Téléphone */}
      <div className="col-tel">
        {p.phone || <span style={{ color: 'var(--ink-4)' }}>—</span>}
      </div>

      {/* Pathologies / alerts */}
      <div className="ptag-row">
        {tags.map((t) => {
          const label = t.length > 24 ? `${t.slice(0, 22)}…` : t;
          return (
            <span key={t} className="ptag dx" title={t}>{label}</span>
          );
        })}
        {p.allergy && <span className="ptag allergy">Allergie</span>}
        {p.pregnant && <span className="ptag preg">Grossesse</span>}
        {extra > 0 && <span className="ptag more">+{extra}</span>}
        {tags.length === 0 && !p.allergy && !p.pregnant && (
          <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>—</span>
        )}
      </div>

      {/* Mutuelle (placeholder — la liste API n'expose pas le nom mutuelle pour l'instant) */}
      <div className="col-mut">
        {p.tier === 'PREMIUM' ? 'Privée' : <span style={{ color: 'var(--ink-4)' }}>—</span>}
      </div>

      {/* Dernier RDV */}
      <div className="col-dt">
        {p.lastVisitAt
          ? new Date(p.lastVisitAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
          : '—'}
      </div>

      {/* Statut */}
      <div>
        <span className={`ppill ${st === 'en-consult' ? 'consult' : st === 'en-attente' ? 'waiting' : st === 'termine' ? 'arrived' : st === 'inactif' ? 'done' : 'arrived'}`}>
          {st === 'en-consult' ? 'En consult.' : st === 'en-attente' ? 'En attente' : st === 'termine' ? 'Terminé' : st === 'inactif' ? 'Inactif' : 'Actif'}
        </span>
      </div>

      {/* Kebab */}
      <button
        type="button"
        className="more-btn"
        onClick={(e) => { e.stopPropagation(); alert('Plus d\'actions : à venir'); }}
        aria-label="Plus d'actions"
      >
        ⋯
      </button>
    </div>
  );
}

// ─── Drail (preview) iso maquette (.drail) ───────────────────────────────
function PatientDrailPanel({
  p,
  onClose,
  onOpen,
}: {
  p: PatientListItem;
  onClose: () => void;
  onOpen: () => void;
}) {
  const navigate = useNavigate();
  const st = statusOf(p);
  return (
    <aside className="drail">
      <div className="drail-h">
        <div className="pav" style={{ background: avatarColor(p.id) }}>
          {p.photoDocumentId
            ? <PatientAvatar initials={initialsOf(p)} documentId={p.photoDocumentId} size="lg" bg={avatarColor(p.id)} />
            : <span>{initialsOf(p)}</span>}
        </div>
        <div className="who">
          <div className="n">{p.firstName} {p.lastName}</div>
          <div className="s">
            <span>{p.gender === 'M' ? 'H' : 'F'} · {p.birthDate ? `${toAge(p.birthDate)} ans` : '—'}</span>
            <span>·</span>
            <span><b>{humanId(p.id)}</b></span>
            {p.tier === 'PREMIUM' && (<><span>·</span><span>Privée</span></>)}
          </div>
        </div>
        <button type="button" className="close-btn" onClick={onClose} aria-label="Fermer">✕</button>
      </div>

      <div className="drail-stat">
        <span className="dot" />
        {st === 'en-consult' && <>EN CONSULTATION — Salle 2</>}
        {st === 'en-attente' && <>EN ATTENTE</>}
        {st === 'termine' && <>CONSULTATION TERMINÉE</>}
        {st === 'actif' && <>PATIENT ACTIF</>}
        {st === 'inactif' && <>PATIENT INACTIF — relance suggérée</>}
        <span className="meta">
          {p.nextAppointmentAt ? formatDateTime(p.nextAppointmentAt) : (p.lastVisitAt ? formatDate(p.lastVisitAt) : '—')}
        </span>
      </div>

      <div className="drail-body">
        {/* Allergies */}
        {p.allergy && (
          <div className="drail-sec">
            <div className="all-strip">
              <div className="ic">!</div>
              <div><b>Allergies :</b> à vérifier dans le dossier complet</div>
            </div>
          </div>
        )}

        {/* Constantes — placeholder (vitals pas exposés sur PatientListItem) */}
        <div className="drail-sec">
          <div className="drail-sec-h">
            Constantes — dernière mesure
            <span className="ln" />
            <button type="button" className="lnk" onClick={onOpen}>Tout voir</button>
          </div>
          <div className="v-snap">
            {[
              { k: 'TA',       v: '—', unit: 'mmHg', ago: 'pas de relevé', warn: false },
              { k: 'FC',       v: '—', unit: 'bpm',  ago: 'pas de relevé', warn: false },
              { k: 'Glycémie', v: '—', unit: 'g/L',  ago: 'pas de relevé', warn: false },
              { k: 'Poids',    v: '—', unit: 'kg',   ago: 'pas de relevé', warn: false },
            ].map((m) => (
              <div key={m.k} className={`cell ${m.warn ? 'warn' : ''}`}>
                <div className="k">{m.k}</div>
                <div className="v">{m.v}<span className="u">{m.unit}</span></div>
                <div className="ago">{m.ago}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dossier */}
        <div className="drail-sec">
          <div className="drail-sec-h">Dossier<span className="ln" /></div>
          <div className="info-rows">
            <div className="info-row"><span className="k">Né le</span><span className="v">{p.birthDate ? formatDate(p.birthDate) : '—'}</span></div>
            <div className="info-row"><span className="k">N° dossier</span><span className="v mono">{humanId(p.id)}</span></div>
            <div className="info-row"><span className="k">CIN</span><span className="v">{p.cin ?? '—'}</span></div>
            <div className="info-row"><span className="k">Adresse</span><span className="v" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>{p.city ?? '—'}</span></div>
            <div className="info-row"><span className="k">Téléphone</span><span className="v">{p.phone ?? '—'}</span></div>
          </div>
        </div>

        {/* Next RDV mini */}
        {p.nextAppointmentAt && (
          <div className="drail-sec">
            <div className="drail-sec-h">Prochain RDV<span className="ln" /></div>
            <button
              type="button"
              className="next-mini"
              onClick={() => navigate(`/agenda?patient=${p.id}`)}
              style={{ border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <div className="when-blk">
                <div className="d">{new Date(p.nextAppointmentAt).getDate()}</div>
                <div className="m">{new Date(p.nextAppointmentAt).toLocaleDateString('fr-FR', { month: 'short' })}</div>
              </div>
              <div className="info">
                <b>{new Date(p.nextAppointmentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</b>
                <span>{formatDate(p.nextAppointmentAt)}</span>
              </div>
              <div className="arrow">›</div>
            </button>
          </div>
        )}
      </div>

      <div className="drail-foot">
        <button type="button" onClick={() => { if (p.phone) window.location.href = `sms:${p.phone}`; }} disabled={!p.phone}>
          SMS
        </button>
        <button type="button" onClick={() => navigate(`/agenda?patient=${p.id}`)}>
          RDV
        </button>
        <button type="button" className="cta" onClick={onOpen}>
          Ouvrir dossier
        </button>
      </div>
    </aside>
  );
}

// ─── Bulk actions bar iso maquette (.bulkbar) ────────────────────────────
function BulkBar({ count, onClear }: { count: number; onClear: () => void }) {
  function notImpl(action: string) {
    alert(`${action} : action à venir (${count} patient${count > 1 ? 's' : ''}).`);
  }
  return (
    <div className="bulkbar">
      <span className="cnt"><b>{count}</b> patient{count > 1 ? 's' : ''} sélectionné{count > 1 ? 's' : ''}</span>
      <span className="sep" />
      <button type="button" className="act" onClick={() => notImpl('Envoyer SMS')}>Envoyer SMS</button>
      <button type="button" className="act" onClick={() => notImpl('Créer relance')}>Créer relance</button>
      <button type="button" className="act" onClick={() => notImpl('Planifier RDV')}>Planifier RDV</button>
      <button type="button" className="act" onClick={() => notImpl('Étiqueter')}>Étiqueter</button>
      <button type="button" className="act" onClick={() => notImpl('Exporter sélection')}>Exporter sélection</button>
      <button type="button" className="clear" onClick={onClear}>Tout désélectionner</button>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────
export default function PatientsListPage() {
  const navigate = useNavigate();
  const [seg, setSeg] = useState<ExtSegment>('tous');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [showNew, setShowNew] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [statusFilter, setStatusFilter] = useState<'' | 'actif' | 'inactif'>('actif');
  const [genderFilter, setGenderFilter] = useState<'' | 'M' | 'F' | 'O'>('');
  const [ageRange, setAgeRange] = useState<'' | 'CHILD' | 'ADULT' | 'SENIOR'>('');
  const [sortBy, setSortBy] = useState<'name' | 'lastVisit' | 'createdAt'>('name');
  const [density, setDensity] = useState<'cozy' | 'compact'>('cozy');
  void density; // utilisé pour ajustement futur du padding (compact)

  const apiSegment: Segment =
    seg === 'nouveaux' ? 'nouveaux'
    : seg === 'chroniques' ? 'chroniques'
    : 'tous';

  const ageBounds: { min?: number; max?: number } = (() => {
    if (seg === 'pediatrie') return { max: 14 };
    if (ageRange === 'CHILD') return { max: 14 };
    if (ageRange === 'ADULT') return { min: 15, max: 64 };
    if (ageRange === 'SENIOR') return { min: 65 };
    return {};
  })();

  const { patients: rawPatients, total, counts, isLoading, error } = usePatientList({
    segment: apiSegment,
    page,
    size: pageSize,
    ...(debouncedSearch.trim() ? { q: debouncedSearch.trim() } : {}),
    ...(genderFilter ? { gender: genderFilter } : {}),
    ...(ageBounds.min != null ? { ageMin: ageBounds.min } : {}),
    ...(ageBounds.max != null ? { ageMax: ageBounds.max } : {}),
  });

  const patients = useMemo(() => {
    let out = rawPatients;
    if (seg === 'sans-rdv') {
      const cutoff = Date.now() - 180 * 86400_000;
      out = out.filter((p) => !p.nextAppointmentAt && (!p.lastVisitAt || new Date(p.lastVisitAt).getTime() < cutoff));
    }
    if (statusFilter === 'inactif') {
      const cutoff = Date.now() - 365 * 86400_000;
      out = out.filter((p) => p.lastVisitAt && new Date(p.lastVisitAt).getTime() < cutoff);
    }
    if (sortBy === 'name') {
      out = [...out].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'fr'));
    } else if (sortBy === 'lastVisit') {
      out = [...out].sort((a, b) => {
        const ad = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
        const bd = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
        return bd - ad;
      });
    }
    return out;
  }, [rawPatients, seg, statusFilter, sortBy]);

  const sansRdvCount = patients.filter((p) => !p.nextAppointmentAt && (!p.lastVisitAt || (Date.now() - new Date(p.lastVisitAt).getTime()) > 180 * 86400_000)).length;
  const mutuelleCount = patients.filter((p) => p.tier === 'PREMIUM').length;

  useEffect(() => {
    setPage(0);
    setCheckedIds(new Set());
  }, [seg, genderFilter, ageRange, debouncedSearch, statusFilter]);

  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canCreatePatient = userPerms == null || userPerms.includes('PATIENT_CREATE');

  const segItems: Array<{ id: ExtSegment; label: string; count: number }> = useMemo(() => [
    { id: 'tous',       label: 'Tous',              count: counts.tous },
    { id: 'actifs',     label: 'Actifs',            count: counts.tous },
    { id: 'nouveaux',   label: 'Nouveaux · 30 j',   count: counts.nouveaux },
    { id: 'chroniques', label: 'Chroniques',        count: counts.chroniques },
    { id: 'sans-rdv',   label: 'Sans RDV · 6 m',    count: sansRdvCount },
    { id: 'pediatrie',  label: 'Pédiatrie',         count: counts.tous },
  ], [counts, sansRdvCount]);

  function toggleCheck(id: string, next: boolean) {
    setCheckedIds((prev) => {
      const s = new Set(prev);
      if (next) s.add(id); else s.delete(id);
      return s;
    });
  }
  function toggleAll(next: boolean) {
    setCheckedIds(next ? new Set(patients.map((p) => p.id)) : new Set());
  }
  const allChecked = patients.length > 0 && patients.every((p) => checkedIds.has(p.id));
  const someChecked = checkedIds.size > 0 && !allChecked;

  function exportCsv() {
    const rows = [['Nom', 'Prénom', 'Sexe', 'Date naissance', 'CIN', 'Téléphone', 'Ville', 'Tier', 'Dernière visite', 'Prochain RDV']];
    for (const p of patients) {
      rows.push([
        p.lastName, p.firstName, p.gender, p.birthDate, p.cin ?? '', p.phone ?? '',
        p.city ?? '', p.tier ?? '',
        p.lastVisitAt ? formatDate(p.lastVisitAt) : '',
        p.nextAppointmentAt ? formatDateTime(p.nextAppointmentAt) : '',
      ]);
    }
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const topRight = (
    <>
      <Button type="button" onClick={exportCsv}>Exporter CSV</Button>
      <Button type="button" onClick={() => alert('Importer un fichier CSV/Excel : à venir.')}>Importer</Button>
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

  const selectedPatient = selected ? patients.find((p) => p.id === selected) ?? null : null;
  const totalPagesEff = Math.max(1, Math.ceil(total / pageSize));
  const sortLabel = sortBy === 'name' ? 'Nom A–Z' : sortBy === 'lastVisit' ? 'Dernière visite' : 'Date de création';
  const sortLabel2 = sortLabel; void sortLabel2;

  return (
    <Screen
      active="patients"
      title="Patients"
      sub={`${counts.tous.toLocaleString('fr-FR')} dossier${counts.tous !== 1 ? 's' : ''}`}
      topbarRight={topRight}
    >
      <div className="ws-patients">

        {/* Saved view tabs */}
        <div className="views" role="tablist">
          {segItems.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={seg === s.id}
              className={seg === s.id ? 'on' : ''}
              onClick={() => setSeg(s.id)}
            >
              {s.label} <span className="ct">{s.count.toLocaleString('fr-FR')}</span>
            </button>
          ))}
          <button
            type="button"
            style={{ color: 'var(--ds2-navy, var(--primary))', fontWeight: 600 }}
            onClick={() => alert('Créer une vue personnalisée : à venir')}
          >+ Vue</button>
          <div className="vside">
            <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>Tri</span>
            <button
              type="button"
              className="fpill"
              onClick={() => {
                const next = sortBy === 'name' ? 'lastVisit' : sortBy === 'lastVisit' ? 'createdAt' : 'name';
                setSortBy(next);
              }}
            >
              <b>{sortLabel}</b><ChevronDown />
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="kpi-strip">
          <div className="kpi hero">
            <div className="k">Patients actifs</div>
            <div className="v">{counts.tous.toLocaleString('fr-FR')}</div>
            <div className="d"><b>+{counts.nouveaux}</b> ce mois · 100% du fichier</div>
          </div>
          <div className="kpi">
            <div className="k"><span className="dot" style={{ background: 'var(--ds2-navy, #1E4DAB)' }} />Nouveaux · 30 j</div>
            <div className="v">{counts.nouveaux.toLocaleString('fr-FR')}</div>
            <div className="d">créés ces 30 derniers jours</div>
          </div>
          <div className="kpi">
            <div className="k"><span className="dot" style={{ background: '#C2553A' }} />Sans RDV · 6 mois</div>
            <div className="v">{sansRdvCount.toLocaleString('fr-FR')}</div>
            <div className="d">{sansRdvCount > 0 ? <b className="warn">Relance suggérée</b> : 'aucune relance'}</div>
          </div>
          <div className="kpi">
            <div className="k"><span className="dot" style={{ background: '#2F8F6B' }} />Mutuelle active</div>
            <div className="v">{mutuelleCount}<span className="u">/ {counts.tous}</span></div>
            <div className="d">CNOPS · CNSS · privée</div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="fbar">
          <div className="search-lg">
            <svg className="search-ico" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
              <circle cx="8" cy="8" r="5" />
              <path d="m15 15-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Nom, CIN, téléphone, n° dossier…"
              aria-label="Rechercher un patient"
            />
          </div>
          {/* Statut chip (toggle) */}
          <button
            type="button"
            className={`fpill ${statusFilter === 'actif' ? 'active' : ''}`}
            onClick={() => setStatusFilter((v) => v === 'actif' ? '' : 'actif')}
            aria-pressed={statusFilter === 'actif'}
          >
            {statusFilter === 'actif' && <span style={{ fontWeight: 700 }}>✓</span>}
            <span className="dim">Statut</span>
            <b>{statusFilter === 'actif' ? 'Actif' : statusFilter === 'inactif' ? 'Inactif' : '—'}</b>
            {statusFilter === 'actif' && (
              <span
                className="x"
                onClick={(e) => { e.stopPropagation(); setStatusFilter(''); }}
              >×</span>
            )}
          </button>
          <FilterChip label="Pathologie" value="—" options={[{ value: '', label: '—' }]} muted />
          <FilterChip label="Mutuelle" value="—" options={[{ value: '', label: '—' }]} muted />
          <FilterChip
            label="Âge"
            value={ageRange === 'CHILD' ? 'Enfant' : ageRange === 'ADULT' ? 'Adulte' : ageRange === 'SENIOR' ? 'Senior' : '—'}
            options={[
              { value: '', label: '—' },
              { value: 'CHILD', label: 'Enfant (0-14)' },
              { value: 'ADULT', label: 'Adulte (15-64)' },
              { value: 'SENIOR', label: 'Senior (65+)' },
            ]}
            onChange={(v) => setAgeRange(v as '' | 'CHILD' | 'ADULT' | 'SENIOR')}
          />
          <FilterChip
            label="Sexe"
            value={genderFilter === 'M' ? 'H' : genderFilter === 'F' ? 'F' : genderFilter === 'O' ? 'A' : 'T.'}
            options={[
              { value: '', label: 'Tous' },
              { value: 'M', label: 'Homme' },
              { value: 'F', label: 'Femme' },
              { value: 'O', label: 'Autre' },
            ]}
            onChange={(v) => setGenderFilter(v as '' | 'M' | 'F' | 'O')}
          />
          <div className="right-tools">
            <button
              type="button"
              className="fpill"
              style={{ height: 30, padding: '0 9px', fontSize: 12 }}
              onClick={() => alert('Filtres avancés : à venir')}
            >
              <FilterIcon /> Filtres avancés
            </button>
            <div className="dens-tog" title="Densité">
              <button
                type="button"
                className={density === 'cozy' ? 'on' : ''}
                onClick={() => setDensity('cozy')}
                title="Confortable"
              >
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M3 5h12M3 9h12M3 13h12" />
                </svg>
              </button>
              <button
                type="button"
                className={density === 'compact' ? 'on' : ''}
                onClick={() => setDensity('compact')}
                title="Compact"
              >
                <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                  <path d="M3 4h12M3 7h12M3 10h12M3 13h12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bulk action bar */}
        {checkedIds.size > 0 && (
          <BulkBar count={checkedIds.size} onClear={() => setCheckedIds(new Set())} />
        )}

        {/* Split: table + detail rail */}
        <div className={`pat-split ${selectedPatient && !showNew ? '' : 'no-rail'}`}>
          <div className="ptbl">
            <div className="ptbl-head">
              <div>
                <span
                  className={`ck ${allChecked ? 'on' : someChecked ? 'dash' : ''}`}
                  onClick={() => toggleAll(!allChecked)}
                  role="checkbox"
                  aria-checked={allChecked}
                  aria-label="Tout sélectionner"
                >
                  {allChecked && '✓'}
                </span>
              </div>
              <div className={`sortable ${sortBy === 'name' ? 'on' : ''}`} onClick={() => setSortBy('name')}>
                Patient <ChevronDown />
              </div>
              <div>Téléphone</div>
              <div>Pathologies / alerts</div>
              <div>Mutuelle</div>
              <div className={`sortable ${sortBy === 'lastVisit' ? 'on' : ''}`} onClick={() => setSortBy('lastVisit')}>
                Dernier RDV <ChevronDown />
              </div>
              <div>Statut</div>
              <div />
            </div>

            <div className="ptbl-body">
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
                    checked={checkedIds.has(p.id)}
                    onCheck={(next) => toggleCheck(p.id, next)}
                    onSelect={() => setSelected(p.id)}
                    onOpen={() => navigate(`/patients/${p.id}`)}
                    practitionerLabel=""
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            <div className="pager">
              <span>
                Affichage <b>{page * pageSize + 1}</b> – <b>{page * pageSize + patients.length}</b> sur <b>{total.toLocaleString('fr-FR')}</b> patient{total !== 1 ? 's' : ''}
              </span>
              <div className="right">
                <span>Par page</span>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                  aria-label="Patients par page"
                >
                  {[10, 20, 50, 100].map((n) => (<option key={n} value={n}>{n}</option>))}
                </Select>
                <div className="pg">
                  <button type="button" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} aria-label="Page précédente">
                    <ChevronLeft />
                  </button>
                  {(() => {
                    const visiblePages: number[] = [];
                    const max = totalPagesEff;
                    for (let i = 0; i < Math.min(3, max); i++) visiblePages.push(i);
                    return visiblePages.map((i) => (
                      <button
                        key={i}
                        type="button"
                        className={i === page ? 'on' : ''}
                        onClick={() => setPage(i)}
                      >{i + 1}</button>
                    ));
                  })()}
                  {totalPagesEff > 4 && <button type="button" disabled>…</button>}
                  {totalPagesEff > 3 && (
                    <button
                      type="button"
                      className={page === totalPagesEff - 1 ? 'on' : ''}
                      onClick={() => setPage(totalPagesEff - 1)}
                    >{totalPagesEff}</button>
                  )}
                  <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPagesEff - 1} aria-label="Page suivante">
                    <ChevronRight />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Drail (detail rail) */}
          {selectedPatient && !showNew && (
            <PatientDrailPanel
              p={selectedPatient}
              onClose={() => setSelected(null)}
              onOpen={() => navigate(`/patients/${selectedPatient.id}`)}
            />
          )}
        </div>

        {showNew && (
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 200, display: 'flex' }}>
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
