/**
 * PregnancyDeclareDialog — modal to declare a new pregnancy.
 * Form: { lmpDate, notes? }. Submit → useDeclarePregnancy. RBAC MEDECIN/ADMIN
 * (caller-enforced — this component renders unconditionally if mounted).
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { DeclarePregnancySchema, type DeclarePregnancyValues } from '../schemas';
import { useDeclarePregnancy } from '../hooks/useDeclarePregnancy';
import { toLocalDate } from '../types';

interface PregnancyDeclareDialogProps {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (pregnancyId: string) => void;
}

export function PregnancyDeclareDialog({
  patientId,
  open,
  onOpenChange,
  onCreated,
}: PregnancyDeclareDialogProps) {
  const { t } = useT();
  const declare = useDeclarePregnancy(patientId);
  const form = useForm<DeclarePregnancyValues>({
    resolver: zodResolver(DeclarePregnancySchema),
    defaultValues: { lmpDate: '', notes: '' },
  });

  async function handleSubmit(values: DeclarePregnancyValues) {
    try {
      const created = await declare.mutateAsync({
        lmpDate: values.lmpDate,
        ...(values.notes ? { notes: values.notes } : {}),
      });
      toast.success(t('gross.declare.success'));
      onCreated?.(created.id);
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error(t('gross.declare.error'));
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
        <Dialog.Content className="gr-dialog" aria-label={t('gross.declare.title')}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Dialog.Title style={{ fontSize: 14.5, fontWeight: 600, flex: 1, margin: 0 }}>
              {t('gross.declare.title')}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')}>
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description
            style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}
          >
            {t('gross.declare.desc')}
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="gr-field">
              <label htmlFor="grd-lmpDate" className="gr-label">
                {t('gross.declare.lmpLabel')}
              </label>
              <Input
                id="grd-lmpDate"
                type="date"
                max={toLocalDate(new Date())}
                {...form.register('lmpDate')}
              />
              {form.formState.errors.lmpDate && (
                <div className="gr-error">{t(form.formState.errors.lmpDate.message ?? '')}</div>
              )}
            </div>

            <div className="gr-field">
              <label htmlFor="grd-notes" className="gr-label">
                {t('gross.declare.notesLabel')}
              </label>
              <Textarea
                id="grd-notes"
                rows={3}
                placeholder={t('gross.declare.notesPlaceholder')}
                {...form.register('notes')}
              />
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
                disabled={declare.isPending}
              >
                {declare.isPending ? t('gross.declare.submitting') : t('gross.declare.submit')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
