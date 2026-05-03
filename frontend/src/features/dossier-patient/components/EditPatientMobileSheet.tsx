/**
 * Bottom-sheet d'édition de patient sur mobile (≤ 640 px).
 *
 * Variante compacte de `EditPatientPanel` desktop (`DossierPage.tsx`) :
 * on permet la modification des champs essentiels (état civil, contact)
 * + photo (téléversement / suppression). Les sections denses (allergies,
 * antécédents, mutuelle, notes médicales libres) restent éditables côté
 * desktop uniquement.
 *
 * Une fois sauvegardée, la requête `usePatient` est invalidée automatiquement
 * par useUpdatePatient → le dossier mobile reflète les changements sans reload.
 */
import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Close, Trash } from '@/components/icons';
import { DocumentUploadButton } from '@/components/ui/DocumentUploadButton';
import { PatientAvatar } from '@/components/ui/PatientAvatar';
import { useUpdatePatient, type UpdatePatientForm } from '../hooks/useUpdatePatient';
import { usePatientPhoto } from '../hooks/usePatientPhoto';
import type { PatientViewApi } from '../hooks/usePatient';

function sanitizeName(v: string): string {
  return v.replace(/[^a-zA-ZÀ-ÿ؀-ۿ\s'-]/g, '');
}

function isValidName(v: string): boolean {
  return /^[a-zA-ZÀ-ÿ؀-ۿ\s'-]{2,}$/.test(v.trim());
}

interface EditPatientMobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: PatientViewApi;
}

export function EditPatientMobileSheet({
  open,
  onOpenChange,
  patient,
}: EditPatientMobileSheetProps) {
  const { update, isPending, error, reset } = useUpdatePatient(patient.id);
  const photo = usePatientPhoto(patient.id);

  const [form, setForm] = useState<UpdatePatientForm>(buildInitial(patient));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // À chaque ouverture (ou quand le patient change), on resync depuis l'API
  // pour ne pas afficher des valeurs obsolètes après un PUT précédent.
  useEffect(() => {
    if (open) {
      setForm(buildInitial(patient));
      setValidationError(null);
      setSaved(false);
      reset();
    }
  }, [open, patient, reset]);

  function set<K extends keyof UpdatePatientForm>(key: K, value: UpdatePatientForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidationError(null);
    setSaved(false);
    reset();
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
    if (!error) {
      setSaved(true);
      setTimeout(() => onOpenChange(false), 600);
    }
  }

  async function handlePhotoFile(file: File) {
    try {
      await photo.upload(file);
    } catch {
      // surfaced via photo.uploadError
    }
  }

  async function handlePhotoRemove() {
    if (!confirm('Supprimer la photo du patient ?')) return;
    try {
      await photo.remove();
    } catch {
      // best-effort
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 80,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            top: 'auto',
            maxHeight: '92vh',
            background: 'var(--surface)',
            borderTopLeftRadius: 'var(--r-lg)',
            borderTopRightRadius: 'var(--r-lg)',
            zIndex: 81,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 -8px 30px rgba(0,0,0,0.18)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <Dialog.Title style={{ fontSize: 14, fontWeight: 700, flex: 1, margin: 0 }}>
              Modifier le patient
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Fermer"
                style={{
                  background: 'transparent',
                  border: 0,
                  cursor: 'pointer',
                  color: 'var(--ink-3)',
                  padding: 4,
                  borderRadius: 4,
                  lineHeight: 0,
                }}
              >
                <Close />
              </button>
            </Dialog.Close>
          </div>

          <form
            onSubmit={(e) => {
              void handleSubmit(e);
            }}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            {/* Photo — upload immédiat (la photo a sa propre mutation, pas attaché au form). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <PatientAvatar
                initials={`${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`}
                documentId={patient.photoDocumentId ?? null}
                size="md"
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <DocumentUploadButton
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  uploadLabel="Téléverser"
                  cameraLabel="Photographier"
                  disabled={photo.isUploading}
                  onFile={(f) => {
                    void handlePhotoFile(f);
                  }}
                />
                {patient.photoDocumentId && (
                  <button
                    type="button"
                    onClick={() => {
                      void handlePhotoRemove();
                    }}
                    disabled={photo.isRemoving}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'none',
                      border: 0,
                      color: 'var(--danger)',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      padding: 0,
                      fontFamily: 'inherit',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Trash style={{ width: 12, height: 12 }} aria-hidden="true" />
                    Supprimer la photo
                  </button>
                )}
                {photo.uploadError && (
                  <div role="alert" style={{ fontSize: 12, color: 'var(--danger)' }}>
                    {photo.uploadError}
                  </div>
                )}
              </div>
            </div>

            <Field label="Prénom *">
              <input
                className="m-input"
                value={form.firstName}
                onChange={(e) => set('firstName', sanitizeName(e.target.value))}
              />
            </Field>

            <Field label="Nom *">
              <input
                className="m-input"
                value={form.lastName}
                onChange={(e) => set('lastName', sanitizeName(e.target.value))}
              />
            </Field>

            <Field label="Sexe">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['M', 'F', 'O'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set('gender', g)}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 8,
                      border: `1px solid ${form.gender === g ? 'var(--primary)' : 'var(--border)'}`,
                      background: form.gender === g ? 'var(--primary-soft)' : 'var(--surface)',
                      color: form.gender === g ? 'var(--primary)' : 'var(--ink-2)',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {g === 'M' ? 'Homme' : g === 'F' ? 'Femme' : 'Autre'}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Date de naissance">
              <input
                className="m-input"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.birthDate}
                onChange={(e) => set('birthDate', e.target.value)}
              />
            </Field>

            <Field label="Téléphone *">
              <input
                className="m-input"
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value.replace(/[^\d\s+\-().]/g, ''))}
                placeholder="+212 6 61 12 34 56"
              />
            </Field>

            <Field label="CIN">
              <input
                className="m-input"
                value={form.cin}
                onChange={(e) => set('cin', e.target.value)}
              />
            </Field>

            <Field label="Email">
              <input
                className="m-input"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>

            <Field label="Ville">
              <input
                className="m-input"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
              />
            </Field>

            {(validationError ?? error) && (
              <div role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>
                {validationError ?? error}
              </div>
            )}

            {saved && (
              <div role="status" style={{ color: 'var(--success, #2E7D32)', fontSize: 12 }}>
                Modifications enregistrées.
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              Allergies, antécédents, mutuelle et notes : modifiables depuis la version desktop.
            </div>

            <button
              type="submit"
              className="m-btn primary"
              disabled={isPending || photo.isUploading || photo.isRemoving}
              style={{ height: 44, marginTop: 4 }}
            >
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function buildInitial(p: PatientViewApi): UpdatePatientForm {
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    gender: (p.gender === 'M' || p.gender === 'F' || p.gender === 'O' ? p.gender : 'M'),
    birthDate: p.birthDate ?? '',
    cin: p.cin ?? '',
    phone: p.phone ?? '',
    email: p.email ?? '',
    city: '',
    bloodGroup: p.bloodGroup ?? '',
    notes: '',
    // Champs médicaux : on garde l'existant, rien à supprimer ni ajouter via cette
    // sheet (édition desktop pour ces champs denses).
    existingAllergies: p.allergies.map((a) => ({
      id: a.id,
      substance: a.substance,
      severity: (a.severity === 'LEGERE' || a.severity === 'MODEREE' || a.severity === 'SEVERE'
        ? a.severity
        : 'MODEREE'),
    })),
    deletedAllergyIds: [],
    newAllergies: [],
    existingAntecedents: p.antecedents.map((a) => ({
      id: a.id,
      type: (a.type === 'MEDICAL' || a.type === 'CHIRURGICAL' || a.type === 'FAMILIAL'
        || a.type === 'GYNECO_OBSTETRIQUE' || a.type === 'HABITUS' ? a.type : 'MEDICAL'),
      description: a.description,
    })),
    deletedAntecedentIds: [],
    newAntecedents: [],
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)' }}>{label}</span>
      {children}
    </label>
  );
}
