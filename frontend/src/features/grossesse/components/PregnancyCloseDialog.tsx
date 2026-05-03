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
import { ClosePregnancySchema, type ClosePregnancyValues } from '../schemas';
import { useClosePregnancy } from '../hooks/useClosePregnancy';
import { OUTCOME_LABEL, toLocalDate, type PregnancyOutcome } from '../types';

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
      toast.success('Grossesse clôturée.');
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error('Impossible de clôturer la grossesse.');
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
        <Dialog.Content className="gr-dialog" aria-label="Clôturer la grossesse">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Dialog.Title style={{ fontSize: 14.5, fontWeight: 600, flex: 1, margin: 0 }}>
              Clôturer la grossesse
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
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
                Date de fin *
              </label>
              <Input
                id="grc-endedAt"
                type="date"
                {...form.register('endedAt')}
              />
              {form.formState.errors.endedAt && (
                <div className="gr-error">{form.formState.errors.endedAt.message}</div>
              )}
            </div>

            <div className="gr-field">
              <label htmlFor="grc-outcome" className="gr-label">
                Issue *
              </label>
              <Select id="grc-outcome" {...form.register('outcome')}>
                <option value="">Sélectionner…</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </Select>
              {form.formState.errors.outcome && (
                <div className="gr-error">
                  {form.formState.errors.outcome.message ?? 'Issue requise'}
                </div>
              )}
            </div>

            <div className="gr-field">
              <label htmlFor="grc-notes" className="gr-label">
                Notes
              </label>
              <Textarea id="grc-notes" rows={3} {...form.register('notes')} />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Dialog.Close asChild>
                <Button type="button" variant="ghost">
                  Annuler
                </Button>
              </Dialog.Close>
              <Button
                type="submit"
                variant="primary"
                disabled={close.isPending}
              >
                {close.isPending ? 'Clôture…' : 'Clôturer'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
