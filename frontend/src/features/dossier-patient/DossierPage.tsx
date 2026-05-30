import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Close, Plus } from '@/components/icons';
import { DocumentUploadButton } from '@/components/ui/DocumentUploadButton';
import { PatientAvatar } from '@/components/ui/PatientAvatar';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/I18nProvider';
import { usePatient } from './hooks/usePatient';
import { usePatientPhoto } from './hooks/usePatientPhoto';
import { useTabCounts } from './hooks/useTabCounts';
import {
  useUpdatePatient,
  type UpdatePatientForm,
  type AllergySeverity,
  type AntecedentType,
} from './hooks/useUpdatePatient';
import { useInsurances } from './hooks/useInsurances';
import { useStartConsultation } from '@/features/salle-attente/hooks/useStartConsultation';
import { useConsultations } from '@/features/consultation/hooks/useConsultations';
import { usePrescriptionsForPatient } from '@/features/prescription/hooks/usePrescriptions';
import { metaForPrescription } from '@/features/prescription/components/DocumentPdfViewer';
import { useInvoicesForPatient, useInvoice } from '@/features/facturation/hooks/useInvoices';
import { InvoiceDrawer } from '@/features/facturation/InvoiceDrawer';
import { STATUS_LABEL as INVOICE_STATUS_LABEL } from '@/features/facturation/types';
import { PatientHeader, AllergyStrip } from './components/PatientHeader';
import { DossierTabs, DossierTabPanel } from './components/DossierTabs';
import { TimelinePanel } from './components/TimelinePanel';
import { SummaryPanel } from './components/SummaryPanel';
import { DocumentsPanel } from './components/DocumentsPanel';
import { BiologicalTrendsPanel } from './components/BiologicalTrendsPanel';
import { VitalsEvolutionPanel } from './components/VitalsEvolutionPanel';
import { VaccinationCalendarTab } from '@/features/vaccination/components/VaccinationCalendarTab';
import { PregnancyTab } from '@/features/grossesse/components/PregnancyTab';
import { StaysTab } from '@/features/hospitalisation/components/StaysTab';
import { ConsentDialog } from '@/features/consent/components/ConsentDialog';
import { useClinicSettings } from '@/features/parametres/hooks/useSettings';
import type { DossierTab } from './types';
import { useAuthStore } from '@/lib/auth/authStore';
import { api } from '@/lib/api/client';
import './dossier-patient.css';
import '@/features/facturation/facturation.css';

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
  const { t } = useT();
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
        <Plus style={{ width: 12, height: 12 }} /> {t('common.add')}
      </button>
    </div>
  );
}

/** Clés i18n des gravités d'allergie (`dossier.severity.*`). */
const SEVERITY_KEYS: Record<AllergySeverity, string> = {
  LEGERE: 'dossier.severity.LEGERE',
  MODEREE: 'dossier.severity.MODEREE',
  SEVERE: 'dossier.severity.SEVERE',
};

const SEVERITY_COLORS: Record<AllergySeverity, { bg: string; color: string; border: string }> = {
  LEGERE:  { bg: 'var(--green-soft, #E8F5E9)', color: '#2E7D32', border: '#A5D6A7' },
  MODEREE: { bg: 'var(--amber-soft, #FFF8E1)', color: '#E65100', border: '#FFCC80' },
  SEVERE:  { bg: 'var(--danger-soft, #FFEBEE)', color: 'var(--danger)', border: '#EF9A9A' },
};

/** Clés i18n des types d'antécédent (`dossier.antecedent.*`). */
const ANTECEDENT_TYPE_KEYS: Record<AntecedentType, string> = {
  MEDICAL: 'dossier.antecedent.MEDICAL',
  CHIRURGICAL: 'dossier.antecedent.CHIRURGICAL',
  FAMILIAL: 'dossier.antecedent.FAMILIAL',
  GYNECO_OBSTETRIQUE: 'dossier.antecedent.GYNECO_OBSTETRIQUE',
  HABITUS: 'dossier.antecedent.HABITUS',
};

const ANTECEDENT_TYPES: AntecedentType[] = [
  'MEDICAL', 'CHIRURGICAL', 'FAMILIAL', 'GYNECO_OBSTETRIQUE', 'HABITUS',
];

function RemoveBtn({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('dossier.form.removeAria')}
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
  initialPhotoDocumentId,
  onClose,
}: {
  patientId: string;
  initial: UpdatePatientForm;
  initialPhotoDocumentId: string | null;
  onClose: () => void;
}) {
  const { t: tr } = useT();
  const { update, isPending, error, reset } = useUpdatePatient(patientId);
  const photo = usePatientPhoto(patientId);
  const { insurances } = useInsurances();
  const [form, setForm] = useState<UpdatePatientForm>(initial);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'personnel' | 'medical'>('personnel');

  async function handlePhotoFile(file: File) {
    try {
      await photo.upload(file);
    } catch {
      // surfaced via photo.uploadError
    }
  }

  async function handlePhotoRemove() {
    if (!confirm(tr('dossier.photo.confirmRemove'))) return;
    try {
      await photo.remove();
    } catch {
      // best-effort
    }
  }

  function setField<K extends keyof UpdatePatientForm>(key: K, value: UpdatePatientForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidationError(null);
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
    // All required fields live on the Personnel tab — bounce there on error
    // so the user actually sees the offending field.
    if (!isValidName(form.firstName)) {
      setActiveTab('personnel');
      setValidationError(tr('dossier.valid.firstName'));
      return;
    }
    if (!isValidName(form.lastName)) {
      setActiveTab('personnel');
      setValidationError(tr('dossier.valid.lastName'));
      return;
    }
    if (!form.phone.trim()) {
      setActiveTab('personnel');
      setValidationError(tr('dossier.valid.phoneRequired'));
      return;
    }
    if (!/^[\d\s+\-().]{6,20}$/.test(form.phone.trim())) {
      setActiveTab('personnel');
      setValidationError(tr('dossier.valid.phoneInvalid'));
      return;
    }
    // mutateAsync resolves on success, rejects on failure. Closing the panel
    // on success matches the pre-regression behavior the user expects — and
    // useUpdatePatient already invalidates ['patient', id] so the parent
    // dossier reflects the new state immediately.
    try {
      await update(form);
      onClose();
    } catch {
      // The mutation's error state (returned as `error`) is rendered below the
      // form — no extra surfacing needed here.
    }
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
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{tr('dossier.form.editPatient')}</span>
        <Button variant="ghost" size="sm" iconOnly aria-label={tr('common.close')} onClick={onClose}>
          <Close />
        </Button>
      </div>

      {/* Tabs (QA3-2) — same split as the creation panel for consistency. */}
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
            {t === 'personnel' ? tr('dossier.form.tabPersonal') : tr('dossier.form.tabMedical')}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => { void handleSubmit(e); }}
        style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, borderTop: '1px solid var(--border)' }}
      >
        {/* ── Onglet Personnel ─────────────────────────────────────────────── */}
        <div hidden={activeTab !== 'personnel'} style={{ display: activeTab === 'personnel' ? 'flex' : 'none', flexDirection: 'column', gap: 14 }}>
          {/* Photo patient (QA5-3) — upload immédiat (le patient existe déjà ici). */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <PatientAvatar
              initials={`${(form.firstName || '?').charAt(0)}${(form.lastName || '?').charAt(0)}`}
              documentId={initialPhotoDocumentId}
              size="lg"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
              <DocumentUploadButton
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                uploadLabel={photo.isUploading ? tr('dossier.photo.sending') : tr('dossier.photo.upload')}
                cameraLabel={tr('dossier.photo.camera')}
                disabled={photo.isUploading || photo.isRemoving}
                onFile={(f) => { void handlePhotoFile(f); }}
              />
              <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                {tr('dossier.photo.formats')}
              </div>
              {initialPhotoDocumentId && (
                <button
                  type="button"
                  onClick={() => { void handlePhotoRemove(); }}
                  disabled={photo.isRemoving}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--ink-3)', fontSize: 11, padding: '2px 0',
                    fontFamily: 'inherit', textDecoration: 'underline',
                  }}
                >
                  {photo.isRemoving ? tr('dossier.photo.removing') : tr('dossier.photo.remove')}
                </button>
              )}
              {photo.uploadError && (
                <div style={{ fontSize: 12, color: 'var(--danger)' }}>{photo.uploadError}</div>
              )}
            </div>
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Lbl>{tr('dossier.form.firstName')}</Lbl>
              <Input value={form.firstName} onChange={(e) => setField('firstName', sanitizeName(e.target.value))} autoFocus />
            </div>
            <div><Lbl>{tr('dossier.form.lastName')}</Lbl>
              <Input value={form.lastName} onChange={(e) => setField('lastName', sanitizeName(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div><Lbl>{tr('dossier.form.sex')}</Lbl>
              <Select
                value={form.gender}
                onChange={(e) => setField('gender', e.target.value as 'M' | 'F' | 'O')}
                style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
              >
                <option value="M">{tr('dossier.form.male')}</option>
                <option value="F">{tr('dossier.form.female')}</option>
                <option value="O">{tr('dossier.form.other')}</option>
              </Select>
            </div>
            <div><Lbl>{tr('dossier.form.birthDate')}</Lbl>
              <Input type="date" value={form.birthDate} onChange={(e) => setField('birthDate', e.target.value)} />
            </div>
          </div>

          <div><Lbl>{tr('dossier.form.cin')}</Lbl>
            <Input value={form.cin} onChange={(e) => setField('cin', e.target.value)} placeholder="BE 328451" />
          </div>

          <div><Lbl>{tr('dossier.form.phone')}</Lbl>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value.replace(/[^\d\s+\-().]/g, ''))}
              placeholder="+212 6 61 12 34 56"
              inputMode="tel"
            />
          </div>

          <div><Lbl>{tr('dossier.form.email')}</Lbl>
            <Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="patient@email.ma" />
          </div>

          <div><Lbl>{tr('dossier.form.city')}</Lbl>
            <Input value={form.city} onChange={(e) => setField('city', e.target.value)} placeholder="Casablanca" />
          </div>

          <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

          {/* ── Tier patient (Normal / Premium) ──────────────────────────── */}
          <div>
            <Lbl>{tr('dossier.form.patientType')}</Lbl>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['NORMAL', 'PREMIUM'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setField('tier', t)}
                  style={{
                    flex: 1,
                    height: 36,
                    fontSize: 12.5,
                    fontWeight: form.tier === t ? 650 : 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    borderRadius: 6,
                    border: `1px solid ${form.tier === t ? 'var(--primary)' : 'var(--border)'}`,
                    background: form.tier === t ? 'var(--primary-soft)' : 'var(--surface)',
                    color: form.tier === t ? 'var(--primary)' : 'var(--ink-2)',
                  }}
                >
                  {t === 'PREMIUM' ? tr('dossier.form.premiumStar') : tr('dossier.form.normal')}
                </button>
              ))}
            </div>
          </div>

          {/* ── Mutuelle ────────────────────────────────────────────────── */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.hasMutuelle}
                onChange={(e) => setField('hasMutuelle', e.target.checked)}
              />
              <span>{tr('dossier.form.hasMutuelle')}</span>
            </label>
          </div>
          {form.hasMutuelle && (
            <>
              <div>
                <Lbl>{tr('dossier.form.organism')}</Lbl>
                <Select
                  value={form.mutuelleInsuranceId}
                  onChange={(e) => setField('mutuelleInsuranceId', e.target.value)}
                  style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
                >
                  <option value="">{tr('dossier.form.selectPlaceholder')}</option>
                  {insurances.map((ins) => (
                    <option key={ins.id} value={ins.id}>{ins.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Lbl>{tr('dossier.form.policyNumber')}</Lbl>
                <Input
                  value={form.mutuellePolicyNumber}
                  onChange={(e) => setField('mutuellePolicyNumber', e.target.value)}
                  placeholder="Ex. CNSS-123456"
                />
              </div>
            </>
          )}
        </div>

        {/* ── Onglet Médical ─────────────────────────────────────────────── */}
        <div hidden={activeTab !== 'medical'} style={{ display: activeTab === 'medical' ? 'flex' : 'none', flexDirection: 'column', gap: 14 }}>
          <div><Lbl>{tr('dossier.form.bloodGroup')}</Lbl>
            <Select
              value={form.bloodGroup}
              onChange={(e) => setField('bloodGroup', e.target.value)}
              style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
            >
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </div>

          {/* ── Divider ───────────────────────────────────────────────── */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* ── Allergies ─────────────────────────────────────────────── */}
        <div>
          <SectionHeader label={tr('dossier.form.allergies')} onAdd={addNewAllergy} />
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
                  {tr(SEVERITY_KEYS[a.severity])}
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
                    placeholder={tr('dossier.form.allergyPlaceholder')}
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
                      {tr(SEVERITY_KEYS[sev])}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {form.existingAllergies.length === 0 && form.newAllergies.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{tr('dossier.form.noAllergy')}</div>
            )}
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────── */}
        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* ── Antécédents ───────────────────────────────────────────── */}
        <div>
          <SectionHeader label={tr('dossier.form.antecedents')} onAdd={addNewAntecedent} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Existing */}
            {form.existingAntecedents.map((a) => (
              <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 650, color: 'var(--primary)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {tr(ANTECEDENT_TYPE_KEYS[a.type])}
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
                  <Select
                    value={a.type}
                    onChange={(e) => updateNewAntecedent(i, { ...a, type: e.target.value as AntecedentType })}
                    style={{ flex: 1, height: 32, border: '1px solid var(--border)', borderRadius: 6, padding: '0 8px', fontSize: 12.5, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--ink)' }}
                  >
                    {ANTECEDENT_TYPES.map((at) => <option key={at} value={at}>{tr(ANTECEDENT_TYPE_KEYS[at])}</option>)}
                  </Select>
                  <RemoveBtn onClick={() => removeNewAntecedent(i)} />
                </div>
                <Textarea
                  value={a.description}
                  onChange={(e) => updateNewAntecedent(i, { ...a, description: e.target.value })}
                  placeholder={tr('dossier.form.descriptionPlaceholder')}
                  style={{ height: 56, fontSize: 12.5, resize: 'vertical' }}
                />
              </div>
            ))}
            {form.existingAntecedents.length === 0 && form.newAntecedents.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>{tr('dossier.form.noAntecedent')}</div>
            )}
          </div>
        </div>

          {/* ── Divider ───────────────────────────────────────────────── */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* ── Notes médicales libres ──────────────────────────────────────────── */}
          <div><Lbl>{tr('dossier.form.notes')}</Lbl>
            <Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} placeholder={tr('dossier.form.notesPlaceholder')} style={{ height: 64 }} />
          </div>

          {/* ── Divider ───────────────────────────────────────────────── */}
          <div style={{ height: 1, background: 'var(--border)' }} />

          {/* ── Documents historiques (QA2-2) ─────────────────────────── */}
          <div>
            <Lbl>{tr('dossier.form.historicalDocs')}</Lbl>
            <DocumentsPanel patientId={patientId} compact />
          </div>
        </div>

        {(validationError ?? error) && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{validationError ?? error}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <Button type="submit" variant="primary" disabled={isPending} style={{ flex: 1 }}>
            {isPending ? tr('common.saving') : tr('common.save')}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>{tr('common.cancel')}</Button>
        </div>
      </form>
    </Panel>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DossierPage() {
  const { t } = useT();
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { patient, raw, isLoading, error } = usePatient(id);
  const [tab, setTab] = useState<DossierTab>('timeline');
  const [showEdit, setShowEdit] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  // R — onglet Facturation : ouvrir la facture cliquée dans un drawer (zoom)
  // au lieu de rediriger vers la liste /facturation (qui perdait le contexte).
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const { startConsultation, isPending: isStartingConsult } = useStartConsultation();
  // QA3-3 v1 — backward-compat: allow when permissions absent.
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canEditPatient = userPerms == null || userPerms.includes('PATIENT_CREATE');
  // Assistant IA (V064) — réservé MEDECIN / ADMIN.
  const userRoles = useAuthStore((s) => s.user?.roles);
  const canUseAi = !!userRoles && (userRoles.includes('MEDECIN') || userRoles.includes('ADMIN'));
  const { consultations: patientConsultations } = useConsultations(
    raw?.id ? { patientId: raw.id } : {},
  );
  const { prescriptions: patientPrescriptions } = usePrescriptionsForPatient(raw?.id);
  const { invoices: patientInvoices } = useInvoicesForPatient(raw?.id);
  const { invoice: selectedInvoice } = useInvoice(selectedInvoiceId ?? undefined);
  const { counts: tabCounts } = useTabCounts(raw?.id);
  const { settings: clinicSettings } = useClinicSettings();

  async function handlePrintSynthese() {
    if (!raw?.id) return;
    setIsPrinting(true);
    try {
      const r = await api.get(`/patients/${raw.id}/synthese-pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data as Blob);
      // <a download> plutôt que window.open : bloqué par le bloqueur de pop-up
      // après un await (ADR-038) — même pattern que le compte-rendu de séjour.
      const a = document.createElement('a');
      a.href = url;
      a.download = `synthese-${(patient?.fullName ?? 'patient').replace(/\s+/g, '-').toLowerCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch {
      toast.error(t('dossier.synthesisError'));
    } finally {
      setIsPrinting(false);
    }
  }

  async function handleNewConsultation() {
    if (!raw) return;
    try {
      const created = await startConsultation({ patientId: raw.id });
      void navigate(`/consultations/${created.id}`);
    } catch {
      toast.error(t('dossier.startConsultError'), {
        description: t('dossier.startConsultErrorDesc'),
      });
    }
  }

  if (isLoading) {
    return (
      <Screen active="patients" title={t('nav.patients')} sub={t('common.loading')} onNavigate={() => {}}>
        <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>{t('dossier.loadingRecord')}</div>
      </Screen>
    );
  }

  if (error || !patient || !raw) {
    return (
      <Screen active="patients" title={t('nav.patients')} sub={t('dossier.errorSub')} onNavigate={() => {}}>
        <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>
          {error ?? t('dossier.recordNotFound')}
        </div>
      </Screen>
    );
  }

  const initialTier: 'NORMAL' | 'PREMIUM' = raw.tier === 'PREMIUM' ? 'PREMIUM' : 'NORMAL';
  const initialHasMutuelle = !!raw.mutuelleInsuranceId;
  const initialMutuelleInsuranceId = raw.mutuelleInsuranceId ?? '';
  const initialMutuellePolicyNumber = raw.mutuellePoliceNumber ?? '';
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
    tier: initialTier,
    hasMutuelle: initialHasMutuelle,
    mutuelleInsuranceId: initialMutuelleInsuranceId,
    mutuellePolicyNumber: initialMutuellePolicyNumber,
    initialTier,
    initialHasMutuelle,
    initialMutuelleInsuranceId,
    initialMutuellePolicyNumber,
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
      title={t('nav.patients')}
      sub={`${patient.fullName} · ${t('dossier.dossierNo', { no: patient.dossierNo })}`}
      onNavigate={(navId) => {
        const map = {
          dashboard: '/dashboard',
          agenda: '/agenda', patients: '/patients', salle: '/salle',
          consult: '/consultations', factu: '/facturation', vaccinations: '/vaccinations',
          grossesses: '/grossesses',
          stock: '/stock',
          queueLab: '/queue/lab',
          queueRadio: '/queue/radio',
          messages: '/messages', catalogue: '/catalogue', params: '/parametres',
        } as const;
        navigate(map[navId]);
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>
        <PatientHeader
          patient={patient}
          {...(canEditPatient ? { onEdit: () => setShowEdit((v) => !v) } : {})}
          {...(canUseAi && raw?.id
            ? {
                onAskAi: () =>
                  navigate(
                    `/assistant?patient=${raw.id}&patientName=${encodeURIComponent(patient.fullName)}`,
                  ),
              }
            : {})}
          onNewConsultation={() => {
            void handleNewConsultation();
          }}
          onPrint={() => {
            void handlePrintSynthese();
          }}
          isPrinting={isPrinting}
          isStartingConsult={isStartingConsult}
        />
        <AllergyStrip patient={patient} />

        <DossierTabs
          value={tab}
          onValueChange={setTab}
          showGrossesse={patient.sex === 'F'}
          showSejours={clinicSettings?.hospitalizationEnabled ?? false}
          counts={tabCounts}
        >
          <DossierTabPanel value="timeline">
            <div className="dp-content">
              <TimelinePanel events={patient.timeline} />
              <SummaryPanel patient={patient} />
            </div>
          </DossierTabPanel>
          <DossierTabPanel value="consults">
            <div className="dp-tab-scroll" style={{ padding: '20px 24px' }}>
              {!raw && (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>{t('common.loading')}</div>
              )}
              {raw && patientConsultations.length === 0 && (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                  {t('dossier.consults.empty')}
                </div>
              )}
              {patientConsultations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {patientConsultations.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => navigate(`/consultations/${c.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {new Date(c.startedAt).toLocaleString('fr-MA', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {c.motif && (
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                            {c.motif}
                          </div>
                        )}
                      </div>
                      <span
                        className={`pill ${c.status === 'SIGNEE' ? 'done' : c.status === 'SUSPENDUE' ? 'arrived' : 'consult'}`}
                        style={{ fontSize: 11 }}
                      >
                        {c.status === 'SIGNEE' ? t('dossier.status.signee') : c.status === 'SUSPENDUE' ? t('dossier.status.suspendue') : t('dossier.status.brouillon')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DossierTabPanel>
          <DossierTabPanel value="vitals">
            <VitalsEvolutionPanel patientId={raw.id} />
          </DossierTabPanel>
          <DossierTabPanel value="prescr">
            <div className="dp-tab-scroll" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <DocumentsPanel patientId={raw.id} filter="PRESCRIPTION_HISTORIQUE" />
              {patientPrescriptions.length === 0 ? (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                  {t('dossier.prescr.empty')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {patientPrescriptions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => navigate(`/prescriptions/${p.id}`)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 14px',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        background: 'var(--surface)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>
                          {metaForPrescription(p).label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                          {new Date(p.issuedAt).toLocaleString('fr-MA', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {p.type !== 'CERT' && p.type !== 'SICK_LEAVE' && (
                            <>
                              {' · '}
                              {p.lines.length} {p.lines.length > 1 ? t('dossier.linePlural') : t('dossier.line')}
                            </>
                          )}
                        </div>
                      </div>
                      {p.allergyOverride && (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'var(--amber-soft)',
                            color: 'var(--amber)',
                            fontWeight: 600,
                          }}
                        >
                          {t('dossier.allergyOverride')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DossierTabPanel>
          <DossierTabPanel value="vaccination">
            <VaccinationCalendarTab patientId={raw.id} />
          </DossierTabPanel>
          {patient.sex === 'F' && (
            <DossierTabPanel value="grossesse">
              <div className="dp-tab-scroll">
                <PregnancyTab patientId={raw.id} />
              </div>
            </DossierTabPanel>
          )}
          {(clinicSettings?.hospitalizationEnabled ?? false) && (
            <DossierTabPanel value="sejours">
              <div className="dp-tab-scroll">
                <StaysTab patientId={raw.id} />
              </div>
            </DossierTabPanel>
          )}
          <DossierTabPanel value="analyses">
            <div className="dp-tab-scroll" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
              <BiologicalTrendsPanel patientId={raw.id} />
              <DocumentsPanel patientId={raw.id} filter="ANALYSE" />
            </div>
          </DossierTabPanel>
          <DossierTabPanel value="imagerie">
            <div className="dp-tab-scroll" style={{ padding: '20px 24px' }}>
              <DocumentsPanel patientId={raw.id} filter="IMAGERIE" />
            </div>
          </DossierTabPanel>
          <DossierTabPanel value="docs">
            <div className="dp-tab-scroll" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* QA9-13 — génération d'un consentement éclairé (PDF rattaché au dossier). */}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="primary" onClick={() => setShowConsent(true)}>
                  <Plus style={{ width: 14, height: 14 }} /> {t('dossier.generateConsent')}
                </Button>
              </div>
              <DocumentsPanel patientId={raw.id} />
            </div>
          </DossierTabPanel>
          <DossierTabPanel value="factu">
            <div className="dp-tab-scroll" style={{ padding: '20px 24px' }}>
              {patientInvoices.length === 0 ? (
                <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>
                  {t('dossier.factu.empty')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {patientInvoices.map((inv) => {
                    const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
                    return (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => setSelectedInvoiceId(inv.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '12px 14px',
                          border: '1px solid var(--border)',
                          borderRadius: 6,
                          background: 'var(--surface)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div className="mono" style={{ fontSize: 13, fontWeight: 600 }}>
                            {inv.number ?? `BR-${inv.id.slice(0, 8).toUpperCase()}`}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
                            {new Date(inv.issuedAt ?? inv.createdAt).toLocaleDateString('fr-MA')}
                            {' · '}
                            {inv.netAmount.toFixed(2).replace('.', ',')} MAD
                            {paid > 0 && (
                              <>
                                {' · '}
                                {t('dossier.collected', { amount: paid.toFixed(2).replace('.', ',') })}
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className={`fa-status-pill ${
                            inv.status === 'BROUILLON'
                              ? 'brouillon'
                              : inv.status === 'EMISE'
                              ? 'emise'
                              : inv.status === 'PAYEE_PARTIELLE'
                              ? 'partielle'
                              : inv.status === 'PAYEE_TOTALE'
                              ? 'totale'
                              : 'annulee'
                          }`}
                        >
                          {INVOICE_STATUS_LABEL[inv.status]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </DossierTabPanel>
        </DossierTabs>

        {showEdit && (
          <EditPatientPanel
            patientId={raw.id}
            initial={editInitial}
            initialPhotoDocumentId={raw.photoDocumentId ?? null}
            onClose={() => setShowEdit(false)}
          />
        )}

        <ConsentDialog
          open={showConsent}
          onOpenChange={setShowConsent}
          patientId={raw.id}
        />

        <InvoiceDrawer
          invoice={selectedInvoice}
          open={!!selectedInvoiceId}
          onOpenChange={(o) => {
            if (!o) setSelectedInvoiceId(null);
          }}
        />
      </div>
    </Screen>
  );
}
