/**
 * Bottom-sheet de création de patient sur mobile (≤ 640 px).
 *
 * Mirroir compact du `NewPatientPanel` desktop (`PatientsListPage.tsx`) :
 * on garde les champs essentiels (photo, état civil, contact, tier) et on
 * laisse les champs denses (allergies, antécédents, mutuelle, documents
 * historiques) au flow desktop pour éviter de bourrer un téléphone.
 *
 * Use case : la secrétaire crée le dossier en quelques secondes pendant
 * que le patient s'installe en salle d'attente, depuis sa tablette.
 */
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Close } from '@/components/icons';
import { DocumentUploadButton } from '@/components/ui/DocumentUploadButton';
import { api } from '@/lib/api/client';
import {
  useCreatePatient,
  type CreatePatientForm,
} from '../hooks/useCreatePatient';

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

function sanitizeName(v: string): string {
  return v.replace(/[^a-zA-ZÀ-ÿ؀-ۿ\s'-]/g, '');
}

function isValidName(v: string): boolean {
  return /^[a-zA-ZÀ-ÿ؀-ۿ\s'-]{2,}$/.test(v.trim());
}

interface NewPatientMobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}

export function NewPatientMobileSheet({
  open,
  onOpenChange,
  onCreated,
}: NewPatientMobileSheetProps) {
  const { create, isPending, error, reset } = useCreatePatient();
  const [form, setForm] = useState<CreatePatientForm>(EMPTY_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  function set<K extends keyof CreatePatientForm>(key: K, value: CreatePatientForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setValidationError(null);
    reset();
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setValidationError(null);
    if (pendingPhoto) URL.revokeObjectURL(pendingPhoto.previewUrl);
    setPendingPhoto(null);
    setPhotoError(null);
    reset();
    onOpenChange(false);
  }

  function setPhotoFromFile(file: File) {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type)) {
      setPhotoError('Format non supporté (JPEG, PNG, WebP, HEIC).');
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
    if (!form.birthDate) {
      setValidationError('La date de naissance est obligatoire.');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (form.birthDate > today) {
      setValidationError('La date de naissance ne peut pas être dans le futur.');
      return;
    }
    const created = await create(form).catch(() => null);
    if (!created) return;

    if (pendingPhoto) {
      setIsUploadingPhoto(true);
      try {
        const fd = new FormData();
        fd.append('file', pendingPhoto.file);
        await api.put(`/patients/${created.id}/photo`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch {
        // Patient créé ; la photo échoue silencieusement (re-tentable depuis le dossier).
      } finally {
        setIsUploadingPhoto(false);
      }
    }

    handleClose();
    onCreated(created.id);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
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
              Nouveau patient
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
            {/* Photo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                aria-hidden="true"
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--bg-alt)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ink-3)',
                  fontSize: 11,
                  flexShrink: 0,
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <DocumentUploadButton
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  uploadLabel="Téléverser"
                  cameraLabel="Photographier"
                  onFile={setPhotoFromFile}
                />
                {pendingPhoto && (
                  <button
                    type="button"
                    onClick={clearPhoto}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--ink-3)',
                      fontSize: 11,
                      padding: 0,
                      fontFamily: 'inherit',
                      textDecoration: 'underline',
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

            <Field label="Prénom *">
              <input
                className="m-input"
                value={form.firstName}
                onChange={(e) => set('firstName', sanitizeName(e.target.value))}
                placeholder="Mohamed"
                autoFocus
              />
            </Field>

            <Field label="Nom *">
              <input
                className="m-input"
                value={form.lastName}
                onChange={(e) => set('lastName', sanitizeName(e.target.value))}
                placeholder="Alami"
              />
            </Field>

            <Field label="Sexe">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['M', 'F', 'O'] as const).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => set('gender', g)}
                    className={form.gender === g ? 'm-pill on' : 'm-pill'}
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

            <Field label="Date de naissance *">
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
                placeholder="BE 328451"
              />
            </Field>

            <Field label="Email">
              <input
                className="m-input"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="patient@email.ma"
              />
            </Field>

            <Field label="Ville">
              <input
                className="m-input"
                value={form.city}
                onChange={(e) => set('city', e.target.value)}
                placeholder="Casablanca"
              />
            </Field>

            <Field label="Type de patient">
              <div style={{ display: 'flex', gap: 6 }}>
                {(['NORMAL', 'PREMIUM'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('tier', t)}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 8,
                      border: `1px solid ${form.tier === t ? 'var(--primary)' : 'var(--border)'}`,
                      background: form.tier === t ? 'var(--primary-soft)' : 'var(--surface)',
                      color: form.tier === t ? 'var(--primary)' : 'var(--ink-2)',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {t === 'PREMIUM' ? '🌟 Premium' : 'Normal'}
                  </button>
                ))}
              </div>
            </Field>

            {(validationError ?? error) && (
              <div role="alert" style={{ color: 'var(--danger)', fontSize: 12 }}>
                {validationError ?? error}
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
              Allergies, antécédents, mutuelle, documents historiques : à compléter
              ensuite depuis le dossier patient (version desktop pour le formulaire complet).
            </div>

            <button
              type="submit"
              className="m-btn primary"
              disabled={isPending || isUploadingPhoto}
              style={{ height: 44, marginTop: 4 }}
            >
              {isUploadingPhoto
                ? 'Téléversement de la photo…'
                : isPending
                ? 'Enregistrement…'
                : 'Créer le patient'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11.5, fontWeight: 550, color: 'var(--ink-2)' }}>{label}</span>
      {children}
    </label>
  );
}
