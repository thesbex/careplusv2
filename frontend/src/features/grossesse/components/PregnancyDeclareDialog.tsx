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
      toast.success('Grossesse déclarée. Plan de visites OMS généré.');
      onCreated?.(created.id);
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error('Impossible de déclarer la grossesse.');
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
        <Dialog.Content className="gr-dialog" aria-label="Déclarer une grossesse">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Dialog.Title style={{ fontSize: 14.5, fontWeight: 600, flex: 1, margin: 0 }}>
              Déclarer une grossesse
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description
            style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 14 }}
          >
            La DPA est calculée automatiquement (Naegele : DDR + 280 j) et
            8 visites prénatales sont planifiées (SA 12, 20, 26, 30, 34, 36, 38, 40).
          </Dialog.Description>

          <form
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div className="gr-field">
              <label htmlFor="grd-lmpDate" className="gr-label">
                Date des dernières règles (DDR) *
              </label>
              <Input
                id="grd-lmpDate"
                type="date"
                max={toLocalDate(new Date())}
                {...form.register('lmpDate')}
              />
              {form.formState.errors.lmpDate && (
                <div className="gr-error">{form.formState.errors.lmpDate.message}</div>
              )}
            </div>

            <div className="gr-field">
              <label htmlFor="grd-notes" className="gr-label">
                Notes (optionnel)
              </label>
              <Textarea
                id="grd-notes"
                rows={3}
                placeholder="Contexte, antécédents pertinents…"
                {...form.register('notes')}
              />
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
                disabled={declare.isPending}
              >
                {declare.isPending ? 'Déclaration…' : 'Déclarer la grossesse'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
