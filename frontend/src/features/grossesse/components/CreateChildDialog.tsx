/**
 * CreateChildDialog — modal to create the child patient record after
 * a TERMINEE/ACCOUCHEMENT_VIVANT pregnancy. Server side, this also
 * triggers the PNI vaccination calendar generation (V022).
 *
 * Visibility : caller renders this only when
 *   pregnancy.status === 'TERMINEE'
 *   && pregnancy.outcome === 'ACCOUCHEMENT_VIVANT'
 *   && pregnancy.childPatientId === null.
 *
 * RBAC : MEDECIN/ADMIN (caller-gated).
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { useT } from '@/lib/i18n/I18nProvider';
import { CreateChildSchema, type CreateChildValues } from '../schemas';
import { useCreateChildFromPregnancy } from '../hooks/useCreateChildFromPregnancy';

interface CreateChildDialogProps {
  pregnancyId: string;
  patientId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateChildDialog({
  pregnancyId,
  patientId,
  open,
  onOpenChange,
}: CreateChildDialogProps) {
  const navigate = useNavigate();
  const { t } = useT();
  const createChild = useCreateChildFromPregnancy(pregnancyId, patientId);
  const form = useForm<CreateChildValues>({
    resolver: zodResolver(CreateChildSchema),
    defaultValues: { firstName: '', sex: undefined as unknown as 'M' | 'F' },
  });

  async function handleSubmit(values: CreateChildValues) {
    try {
      const res = await createChild.mutateAsync({
        firstName: values.firstName,
        sex: values.sex,
      });
      toast.success(t('gross.child.success'));
      form.reset();
      onOpenChange(false);
      void navigate(`/patients/${res.childPatientId}`);
    } catch {
      toast.error(t('gross.child.error'));
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
        <Dialog.Content className="gr-dialog" aria-label={t('gross.child.title')}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Dialog.Title style={{ fontSize: 14.5, fontWeight: 600, flex: 1, margin: 0 }}>
              {t('gross.child.title')}
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
            {t('gross.child.desc')}
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="gr-field">
              <label htmlFor="grcc-firstName" className="gr-label">
                {t('gross.child.firstNameLabel')}
              </label>
              <Input
                id="grcc-firstName"
                placeholder={t('gross.child.firstNamePlaceholder')}
                {...form.register('firstName')}
                autoFocus
              />
              {form.formState.errors.firstName && (
                <div className="gr-error">{t(form.formState.errors.firstName.message ?? '')}</div>
              )}
            </div>

            <div className="gr-field">
              <label htmlFor="grcc-sex" className="gr-label">
                {t('gross.child.sexLabel')}
              </label>
              <Select id="grcc-sex" {...form.register('sex')}>
                <option value="">{t('gross.child.sexPlaceholder')}</option>
                <option value="M">{t('gross.child.sexM')}</option>
                <option value="F">{t('gross.child.sexF')}</option>
              </Select>
              {form.formState.errors.sex && (
                <div className="gr-error">
                  {t(form.formState.errors.sex.message ?? 'gross.child.sexRequired')}
                </div>
              )}
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
                disabled={createChild.isPending}
              >
                {createChild.isPending ? t('gross.child.submitting') : t('gross.child.submit')}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
