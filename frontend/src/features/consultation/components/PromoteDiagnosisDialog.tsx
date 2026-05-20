/**
 * Dialog "Ajouter aux antécédents" — promeut le diagnostic courant
 * (Appréciation SOAP) en antécédent médical structuré.
 *
 * Pré-rempli avec la valeur du champ Appréciation, libre à éditer avant
 * sauvegarde. Le médecin choisit type / catégorie / date de survenue.
 *
 * Accessible depuis ConsultationPage (desktop + mobile) via un bouton
 * "+ Ajouter aux antécédents" placé sous l'Appréciation.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Field, FieldLabel } from '@/components/ui/Field';
import {
  usePromoteDiagnosis,
  type AntecedentCategory,
  type AntecedentType,
} from '../hooks/usePromoteDiagnosis';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Texte courant du champ Appréciation — pré-rempli dans la description. */
  initialDescription: string;
  /** ISO date `YYYY-MM-DD` — défaut pour le champ "Survenu le". */
  defaultOccurredOn: string;
  onSuccess?: () => void;
}

const TYPE_OPTIONS: { value: AntecedentType; label: string }[] = [
  { value: 'MEDICAL', label: 'Médical' },
  { value: 'CHIRURGICAL', label: 'Chirurgical' },
  { value: 'FAMILIAL', label: 'Familial' },
  { value: 'GYNECO_OBSTETRIQUE', label: 'Gynéco-obstétrique' },
  { value: 'HABITUS', label: 'Habitudes de vie' },
];

const CATEGORY_OPTIONS: { value: AntecedentCategory; label: string }[] = [
  { value: 'PERSONNEL_MALADIES_CHRONIQUES', label: 'Maladies chroniques' },
  { value: 'PERSONNEL_MALADIES_PASSEES', label: 'Maladies passées' },
  { value: 'PERSONNEL_CHIRURGIES', label: 'Chirurgies' },
  { value: 'PERSONNEL_HOSPITALISATIONS', label: 'Hospitalisations' },
  { value: 'PERSONNEL_TRAUMATISMES', label: 'Traumatismes' },
  { value: 'PERSONNEL_ALLERGIES', label: 'Allergies' },
  { value: 'FAMILIAL', label: 'Familial' },
  { value: 'MEDICAMENTEUX_EN_COURS', label: 'Médicaments en cours' },
  { value: 'MEDICAMENTEUX_PASSES', label: 'Médicaments passés' },
  { value: 'MEDICAMENTEUX_AUTOMEDICATION', label: 'Automédication' },
  { value: 'SOCIAL_TABAC', label: 'Tabac' },
  { value: 'SOCIAL_ALCOOL', label: 'Alcool' },
  { value: 'SOCIAL_DROGUES', label: 'Drogues' },
  { value: 'SOCIAL_ACTIVITE_PHYSIQUE', label: 'Activité physique' },
  { value: 'SOCIAL_PROFESSION', label: 'Profession' },
  { value: 'GYNECO_OBSTETRICAL', label: 'Gynéco-obstétrical' },
  { value: 'PSYCHIATRIQUE', label: 'Psychiatrique' },
];

const DESC_MAX = 512;

export function PromoteDiagnosisDialog({
  open,
  onOpenChange,
  patientId,
  initialDescription,
  defaultOccurredOn,
  onSuccess,
}: Props) {
  const { promote, isPending } = usePromoteDiagnosis();

  const [description, setDescription] = useState(initialDescription);
  const [type, setType] = useState<AntecedentType>('MEDICAL');
  const [category, setCategory] = useState<AntecedentCategory | ''>(
    'PERSONNEL_MALADIES_CHRONIQUES',
  );
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);

  // Re-sync quand on rouvre le dialog après une autre consultation / diagnostic.
  useEffect(() => {
    if (open) {
      setDescription(initialDescription);
      setType('MEDICAL');
      setCategory('PERSONNEL_MALADIES_CHRONIQUES');
      setOccurredOn(defaultOccurredOn);
    }
  }, [open, initialDescription, defaultOccurredOn]);

  if (!open) return null;

  async function handleSave() {
    const trimmed = description.trim();
    if (trimmed.length === 0) {
      toast.error('La description est requise.');
      return;
    }
    if (trimmed.length > DESC_MAX) {
      toast.error(`Description trop longue (maximum ${DESC_MAX} caractères).`);
      return;
    }
    try {
      await promote({
        patientId,
        type,
        description: trimmed,
        occurredOn: occurredOn || null,
        category: category === '' ? null : category,
      });
      toast.success('Antécédent ajouté.');
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 400) {
        toast.error('Données invalides — vérifiez les champs.');
      } else if (status === 403) {
        toast.error("Vous n'avez pas les droits pour cette action.");
      } else {
        toast.error("Échec de l'enregistrement.");
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter le diagnostic aux antécédents"
      data-testid="promote-diagnosis-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.45)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPending) onOpenChange(false);
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 10,
          width: 'min(520px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 32px)',
          overflow: 'auto',
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>
          Ajouter ce diagnostic aux antécédents
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          Le diagnostic devient un antécédent médical structuré du dossier
          patient. Modifiez le libellé avant d'enregistrer si besoin.
        </div>

        <Field>
          <FieldLabel htmlFor="promote-desc">Description *</FieldLabel>
          <textarea
            id="promote-desc"
            data-testid="promote-diagnosis-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={DESC_MAX}
            disabled={isPending}
            style={{
              width: '100%',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: 8,
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              background: 'var(--surface)',
            }}
          />
          <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>
            {description.length} / {DESC_MAX} caractères
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field>
            <FieldLabel htmlFor="promote-type">Type *</FieldLabel>
            <select
              id="promote-type"
              value={type}
              disabled={isPending}
              onChange={(e) => setType(e.target.value as AntecedentType)}
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
              {TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="promote-occurred">Survenu le</FieldLabel>
            <input
              id="promote-occurred"
              type="date"
              value={occurredOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              disabled={isPending}
              style={{
                height: 36,
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0 10px',
                fontSize: 13,
                fontFamily: 'inherit',
                background: 'var(--surface)',
              }}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="promote-category">Catégorie</FieldLabel>
          <select
            id="promote-category"
            value={category}
            disabled={isPending}
            onChange={(e) =>
              setCategory(e.target.value === '' ? '' : (e.target.value as AntecedentCategory))
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
            <option value="">— Aucune —</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 4,
          }}
        >
          <Button onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button
            variant="primary"
            disabled={isPending}
            onClick={() => void handleSave()}
          >
            {isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </div>
    </div>
  );
}
