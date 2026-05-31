/**
 * PregnancyUltrasoundDrawer — saisie d'une échographie obstétricale.
 *
 * Form fields :
 *  - kind (T1_DATATION | T2_MORPHO | T3_CROISSANCE | AUTRE)
 *  - performedAt (date)
 *  - saWeeksAtExam / saDaysAtExam
 *  - findings (compte-rendu textuel)
 *  - biometry JSON ({bip, pc, dat, lf, eg, percentile}) — affichage adapté au kind
 *  - correctsDueDate : visible uniquement si kind === 'T1_DATATION'
 *  - documentId : optional via DocumentUploadButton
 *
 * RBAC MEDECIN/ADMIN — caller-gated.
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { DocumentUploadButton } from '@/components/ui/DocumentUploadButton';
import { usePatientDocuments } from '@/features/dossier-patient/hooks/usePatientDocuments';
import { useT } from '@/lib/i18n/I18nProvider';
import { RecordUltrasoundSchema, type RecordUltrasoundValues } from '../schemas';
import { useRecordUltrasound } from '../hooks/useRecordUltrasound';
import {
  ULTRASOUND_KIND_LABEL_KEY,
  toLocalDate,
  type Pregnancy,
  type UltrasoundKind,
} from '../types';

interface PregnancyUltrasoundDrawerProps {
  pregnancy: Pregnancy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KINDS: UltrasoundKind[] = ['T1_DATATION', 'T2_MORPHO', 'T3_CROISSANCE', 'AUTRE'];

export function PregnancyUltrasoundDrawer({
  pregnancy,
  open,
  onOpenChange,
}: PregnancyUltrasoundDrawerProps) {
  const { t } = useT();
  const recordUs = useRecordUltrasound(pregnancy.id, pregnancy.patientId);
  const { upload, isUploading } = usePatientDocuments(pregnancy.patientId);
  const [documentId, setDocumentId] = useState<string | null>(null);

  async function handleUpload(file: File) {
    try {
      const doc = await upload({ file, type: 'IMAGERIE' });
      setDocumentId(doc.id);
      toast.success(t('gross.us.crAttached'));
    } catch {
      toast.error(t('gross.us.uploadError'));
    }
  }

  const form = useForm<RecordUltrasoundValues>({
    resolver: zodResolver(RecordUltrasoundSchema),
    defaultValues: {
      kind: 'T1_DATATION',
      performedAt: toLocalDate(new Date()),
      saWeeksAtExam: pregnancy.saWeeks ?? 12,
      saDaysAtExam: pregnancy.saDays ?? 0,
      correctsDueDate: false,
      biometry: {},
    },
  });

  const kind = form.watch('kind');
  const correctsDueDateVisible = kind === 'T1_DATATION';

  async function handleSubmit(values: RecordUltrasoundValues) {
    try {
      await recordUs.mutateAsync({
        kind: values.kind,
        performedAt: values.performedAt,
        saWeeksAtExam: values.saWeeksAtExam,
        saDaysAtExam: values.saDaysAtExam,
        ...(values.findings ? { findings: values.findings } : {}),
        ...(values.biometry ? { biometry: values.biometry } : {}),
        // Force correctsDueDate to false unless kind=T1_DATATION (defensive).
        correctsDueDate:
          values.kind === 'T1_DATATION' ? values.correctsDueDate : false,
        ...(documentId ? { documentId } : {}),
      });
      toast.success(t('gross.us.success'));
      form.reset();
      setDocumentId(null);
      onOpenChange(false);
    } catch {
      toast.error(t('gross.us.error'));
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          form.reset();
          setDocumentId(null);
        }
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="gr-overlay" />
        <Dialog.Content className="gr-drawer" aria-label={t('gross.us.drawerTitle')}>
          <div className="gr-drawer-header">
            <Dialog.Title className="gr-drawer-title">{t('gross.us.drawerTitle')}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <form
            id="grossesse-us-form"
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}
            className="gr-drawer-body"
          >
            <div className="gr-field">
              <label htmlFor="grus-kind" className="gr-label">
                {t('gross.us.kindLabel')}
              </label>
              <Select id="grus-kind" {...form.register('kind')}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(ULTRASOUND_KIND_LABEL_KEY[k])}
                  </option>
                ))}
              </Select>
            </div>

            <div className="gr-field">
              <label htmlFor="grus-performedAt" className="gr-label">
                {t('gross.us.dateLabel')}
              </label>
              <Input
                id="grus-performedAt"
                type="date"
                max={toLocalDate(new Date())}
                {...form.register('performedAt')}
              />
              {form.formState.errors.performedAt && (
                <div className="gr-error">
                  {t(form.formState.errors.performedAt.message ?? '')}
                </div>
              )}
            </div>

            <div className="gr-grid-2">
              <div className="gr-field">
                <label htmlFor="grus-saw" className="gr-label">
                  {t('gross.us.saWeeksLabel')}
                </label>
                <Input
                  id="grus-saw"
                  type="number"
                  min={4}
                  max={44}
                  {...form.register('saWeeksAtExam', { valueAsNumber: true })}
                />
                {form.formState.errors.saWeeksAtExam && (
                  <div className="gr-error">
                    {t(form.formState.errors.saWeeksAtExam.message ?? '')}
                  </div>
                )}
              </div>
              <div className="gr-field">
                <label htmlFor="grus-sad" className="gr-label">
                  {t('gross.us.saDaysLabel')}
                </label>
                <Input
                  id="grus-sad"
                  type="number"
                  min={0}
                  max={6}
                  {...form.register('saDaysAtExam', { valueAsNumber: true })}
                />
                {form.formState.errors.saDaysAtExam && (
                  <div className="gr-error">
                    {t(form.formState.errors.saDaysAtExam.message ?? '')}
                  </div>
                )}
              </div>
            </div>

            <div className="gr-field">
              <span className="gr-label">{t('gross.us.biometryLabel')}</span>
              <div className="gr-grid-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="BIP"
                  aria-label={t('gross.us.bipAria')}
                  {...form.register('biometry.bip', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="PC"
                  aria-label={t('gross.us.pcAria')}
                  {...form.register('biometry.pc', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="DAT"
                  aria-label={t('gross.us.datAria')}
                  {...form.register('biometry.dat', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="LF"
                  aria-label={t('gross.us.lfAria')}
                  {...form.register('biometry.lf', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="1"
                  placeholder={t('gross.us.egPlaceholder')}
                  aria-label={t('gross.us.egAria')}
                  {...form.register('biometry.eg', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="1"
                  min={0}
                  max={100}
                  placeholder={t('gross.us.percentilePlaceholder')}
                  aria-label={t('gross.us.percentileAria')}
                  {...form.register('biometry.percentile', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="gr-field">
              <label htmlFor="grus-findings" className="gr-label">
                {t('gross.us.findingsLabel')}
              </label>
              <Textarea
                id="grus-findings"
                rows={4}
                placeholder={t('gross.us.findingsPlaceholder')}
                {...form.register('findings')}
              />
            </div>

            {correctsDueDateVisible && (
              <div className="gr-field">
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                  }}
                >
                  <input
                    type="checkbox"
                    {...form.register('correctsDueDate')}
                    data-testid="us-corrects-duedate"
                  />
                  {t('gross.us.correctsDpaLabel')}
                </label>
                <span className="gr-help">
                  {t('gross.us.correctsDpaHelp')}
                </span>
              </div>
            )}

            <div className="gr-field">
              <span className="gr-label">{t('gross.us.crPdfFieldLabel')}</span>
              <DocumentUploadButton
                accept="application/pdf,image/*"
                disabled={isUploading}
                uploadLabel={
                  isUploading
                    ? t('gross.us.uploading')
                    : documentId
                      ? t('gross.us.docAttached')
                      : t('gross.us.uploadCr')
                }
                onFile={(file) => {
                  void handleUpload(file);
                }}
              />
              {documentId && (
                <span className="gr-help">{t('gross.us.docAttachedRef', { id: documentId })}</span>
              )}
            </div>
          </form>

          <div className="gr-drawer-footer">
            <Button
              type="submit"
              form="grossesse-us-form"
              variant="primary"
              disabled={recordUs.isPending}
              style={{ flex: 1 }}
            >
              {recordUs.isPending ? t('gross.us.submitting') : t('gross.us.submit')}
            </Button>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost">
                {t('common.cancel')}
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
