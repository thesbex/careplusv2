/**
 * PregnancyCloseDialog — modal to close a pregnancy.
 * Form: { endedAt, outcome, notes? } → POST /pregnancies/:id/close.
 * RBAC MEDECIN/ADMIN — gated by caller.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { ClosePregnancySchema, type ClosePregnancyValues } from '../schemas';
import { useClosePregnancy } from '../hooks/useClosePregnancy';
import { OUTCOME_LABEL_KEY, toLocalDate, type PregnancyOutcome } from '../types';

interface PregnancyCloseDialogProps {
  pregnancyId: string;
  patientId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const OUTCOMES: PregnancyOutcome[] = [
  'ACCOUCHEMENT_VIVANT',
  'MORT_NEE',
  'MFIU',
  'FCS',
  'IVG',
  'GEU',
  'MOLE',
];

export function PregnancyCloseDialog({
  pregnancyId,
  patientId,
  open,
  onOpenChange,
}: PregnancyCloseDialogProps) {
  const { t } = useT();
  const close = useClosePregnancy(pregnancyId, patientId);
  const form = useForm<ClosePregnancyValues>({
    resolver: zodResolver(ClosePregnancySchema),
    defaultValues: { endedAt: toLocalDate(new Date()), outcome: undefined as unknown as PregnancyOutcome, notes: '' },
  });

  async function handleSubmit(values: ClosePregnancyValues) {
    try {
      await close.mutateAsync({
        endedAt: values.endedAt,
        outcome: values.outcome,
        ...(values.notes ? { notes: values.notes } : {}),
      });
      toast.success(t('gross.close.success'));
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error(t('gross.close.error'));
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) form.reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="gr-overlay" />
        <Dialog.Content className="gr-dialog" aria-label={t('gross.close.title')}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Dialog.Title style={{ fontSize: 14.5, fontWeight: 600, flex: 1, margin: 0 }}>
              {t('gross.close.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <form
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="gr-field">
              <label htmlFor="grc-endedAt" className="gr-label">
                {t('gross.close.endedAtLabel')}
              </label>
              <Input
                id="grc-endedAt"
                type="date"
                {...form.register('endedAt')}
              />
              {form.formState.errors.endedAt && (
                <div className="gr-error">{t(form.formState.errors.endedAt.message ?? '')}</div>
              )}
            </div>

            <div className="gr-field">
              <label htmlFor="grc-outcome" className="gr-label">
                {t('gross.close.outcomeLabel')}
              </label>
              <Select id="grc-outcome" {...form.register('outcome')}>
                <option value="">{t('gross.close.outcomePlaceholder')}</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {t(OUTCOME_LABEL_KEY[o])}
                  </option>
                ))}
              </Select>
              {form.formState.errors.outcome && (
                <div className="gr-error">
                  {t(form.formState.errors.outcome.message ?? 'gross.close.outcomeRequired')}
                </div>
              )}
            </div>

            <div className="gr-field">
              <label htmlFor="grc-notes" className="gr-label">
                {t('gross.close.notesLabel')}
              </label>
              <Textarea id="grc-notes" rows={3} {...form.register('notes')} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  {t('common.cancel')}
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                variant="primary"
                disabled={close.isPending}
              >
                {close.isPending ? t('gross.close.submitting') : t('gross.close.submit')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
