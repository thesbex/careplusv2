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
import { useT } from '@/lib/i18n/I18nProvider';
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

const TYPE_OPTIONS: AntecedentType[] = [
  'MEDICAL',
  'CHIRURGICAL',
  'FAMILIAL',
  'GYNECO_OBSTETRIQUE',
  'HABITUS',
];

const CATEGORY_OPTIONS: AntecedentCategory[] = [
  'PERSONNEL_MALADIES_CHRONIQUES',
  'PERSONNEL_MALADIES_PASSEES',
  'PERSONNEL_CHIRURGIES',
  'PERSONNEL_HOSPITALISATIONS',
  'PERSONNEL_TRAUMATISMES',
  'PERSONNEL_ALLERGIES',
  'FAMILIAL',
  'MEDICAMENTEUX_EN_COURS',
  'MEDICAMENTEUX_PASSES',
  'MEDICAMENTEUX_AUTOMEDICATION',
  'SOCIAL_TABAC',
  'SOCIAL_ALCOOL',
  'SOCIAL_DROGUES',
  'SOCIAL_ACTIVITE_PHYSIQUE',
  'SOCIAL_PROFESSION',
  'GYNECO_OBSTETRICAL',
  'PSYCHIATRIQUE',
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
  const { t } = useT();
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
      toast.error(t('consult.promote.descRequired'));
      return;
    }
    if (trimmed.length > DESC_MAX) {
      toast.error(t('consult.promote.descTooLong', { max: DESC_MAX }));
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
      toast.success(t('consult.promote.added'));
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 400) {
        toast.error(t('consult.promote.invalid'));
      } else if (status === 403) {
        toast.error(t('consult.promote.forbidden'));
      } else {
        toast.error(t('consult.promote.saveError'));
      }
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('consult.promote.aria')}
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
          {t('consult.promote.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
          {t('consult.promote.description')}
        </div>

        <Field>
          <FieldLabel htmlFor="promote-desc">{t('consult.promote.descLabel')}</FieldLabel>
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
            {t('consult.promote.charCount', { n: description.length, max: DESC_MAX })}
          </div>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field>
            <FieldLabel htmlFor="promote-type">{t('consult.promote.typeLabel')}</FieldLabel>
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
              {TYPE_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {t(`consult.antType.${value}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <FieldLabel htmlFor="promote-occurred">{t('consult.promote.occurredOn')}</FieldLabel>
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
          <FieldLabel htmlFor="promote-category">{t('consult.promote.category')}</FieldLabel>
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
            <option value="">{t('consult.promote.categoryNone')}</option>
            {CATEGORY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {t(`consult.antCat.${value}`)}
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
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={isPending}
            onClick={() => void handleSave()}
          >
            {isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}
