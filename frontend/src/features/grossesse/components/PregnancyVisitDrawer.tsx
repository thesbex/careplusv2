/**
 * PregnancyVisitDrawer — desktop slide-in form to capture obstetric biométrie.
 *
 * Form is *contextual* to current SA :
 *  - Always : poids, TA, BU (6 booleans)
 *  - SA >= 12 : BCF (fetal heart rate)
 *  - SA >= 20 : HU (fundal height)
 *  - SA >= 24 : MAF (perceived movements, boolean)
 *  - SA >= 32 : présentation (céphalique / siège / transverse / indéterminée)
 *
 * RBAC ASSISTANT/MEDECIN/ADMIN — caller gates rendering.
 */
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Close } from '@/components/icons';
import { RecordVisitSchema, type RecordVisitValues } from '../schemas';
import { useRecordVisit } from '../hooks/useRecordVisit';
import { PRESENTATION_LABEL, type Presentation, type Pregnancy } from '../types';

interface PregnancyVisitDrawerProps {
  pregnancy: Pregnancy;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function nowLocal(): string {
  // Build a YYYY-MM-DDTHH:mm string from local components — avoid toISOString
  // (drifts in non-UTC timezones, see feedback_local_date_iso.md).
  const d = new Date();
  d.setSeconds(0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

const PRESENTATIONS: Presentation[] = [
  'CEPHALIQUE',
  'SIEGE',
  'TRANSVERSE',
  'INDETERMINEE',
];

export function PregnancyVisitDrawer({
  pregnancy,
  open,
  onOpenChange,
}: PregnancyVisitDrawerProps) {
  const sa = pregnancy.saWeeks ?? 0;

  const showBcf = sa >= 12;
  const showHu = sa >= 20;
  const showMaf = sa >= 24;
  const showPresentation = sa >= 32;

  const recordVisit = useRecordVisit(pregnancy.id);

  const form = useForm<RecordVisitValues>({
    resolver: zodResolver(RecordVisitSchema),
    defaultValues: {
      recordedAt: nowLocal(),
      urineDip: {
        glucose: false,
        protein: false,
        leuco: false,
        nitrites: false,
        ketones: false,
        blood: false,
      },
    },
  });

  async function handleSubmit(values: RecordVisitValues) {
    // Convert datetime-local to ISO. Use Date constructor (treats input as local).
    try {
      const recordedAtIso = new Date(values.recordedAt).toISOString();
      await recordVisit.mutateAsync({
        recordedAt: recordedAtIso,
        ...(values.weightKg !== undefined ? { weightKg: values.weightKg } : {}),
        ...(values.bpSystolic !== undefined ? { bpSystolic: values.bpSystolic } : {}),
        ...(values.bpDiastolic !== undefined ? { bpDiastolic: values.bpDiastolic } : {}),
        ...(values.urineDip ? { urineDip: values.urineDip } : {}),
        ...(values.fundalHeightCm !== undefined ? { fundalHeightCm: values.fundalHeightCm } : {}),
        ...(values.fetalHeartRateBpm !== undefined ? { fetalHeartRateBpm: values.fetalHeartRateBpm } : {}),
        ...(values.fetalMovementsPerceived !== undefined
          ? { fetalMovementsPerceived: values.fetalMovementsPerceived }
          : {}),
        ...(values.presentation ? { presentation: values.presentation } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      });
      toast.success('Visite enregistrée.');
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error('Impossible d\'enregistrer la visite.');
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
        <Dialog.Content className="gr-drawer" aria-label="Saisir une visite">
          <div className="gr-drawer-header">
            <Dialog.Title className="gr-drawer-title">
              Saisir une visite — SA {sa} sem
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <form
            id="grossesse-visit-form"
            onSubmit={(e) => {
              void form.handleSubmit(handleSubmit)(e);
            }}
            className="gr-drawer-body"
          >
            <div className="gr-field">
              <label htmlFor="grv-recordedAt" className="gr-label">
                Date et heure *
              </label>
              <Input
                id="grv-recordedAt"
                type="datetime-local"
                {...form.register('recordedAt')}
              />
              {form.formState.errors.recordedAt && (
                <div className="gr-error">
                  {form.formState.errors.recordedAt.message}
                </div>
              )}
            </div>

            <div className="gr-grid-2">
              <div className="gr-field">
                <label htmlFor="grv-weightKg" className="gr-label">
                  Poids (kg)
                </label>
                <Input
                  id="grv-weightKg"
                  type="number"
                  step="0.1"
                  min={30}
                  max={180}
                  placeholder="65.0"
                  {...form.register('weightKg', { valueAsNumber: true })}
                />
                {form.formState.errors.weightKg && (
                  <div className="gr-error">
                    {form.formState.errors.weightKg.message}
                  </div>
                )}
              </div>
              <div />
            </div>

            <div className="gr-field">
              <span className="gr-label">Tension artérielle (mmHg)</span>
              <div className="gr-grid-2">
                <Input
                  type="number"
                  min={60}
                  max={220}
                  placeholder="Syst. (60-220)"
                  aria-label="TA systolique"
                  {...form.register('bpSystolic', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  min={30}
                  max={140}
                  placeholder="Diast. (30-140)"
                  aria-label="TA diastolique"
                  {...form.register('bpDiastolic', { valueAsNumber: true })}
                />
              </div>
              {(form.formState.errors.bpSystolic ?? form.formState.errors.bpDiastolic) && (
                <div className="gr-error">
                  {form.formState.errors.bpSystolic?.message ??
                    form.formState.errors.bpDiastolic?.message}
                </div>
              )}
            </div>

            <fieldset className="gr-field" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="gr-label">Bandelette urinaire</legend>
              <div className="gr-checkbox-row" data-testid="urine-dip-row">
                {(
                  [
                    ['glucose', 'Glucose'],
                    ['protein', 'Protéines'],
                    ['leuco', 'Leucocytes'],
                    ['nitrites', 'Nitrites'],
                    ['ketones', 'Cétones'],
                    ['blood', 'Sang'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      {...form.register(`urineDip.${key}` as const)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>

            {showBcf && (
              <div className="gr-field">
                <label htmlFor="grv-bcf" className="gr-label">
                  BCF — Bruits du cœur fœtal (bpm)
                </label>
                <Input
                  id="grv-bcf"
                  type="number"
                  min={100}
                  max={200}
                  placeholder="140"
                  {...form.register('fetalHeartRateBpm', { valueAsNumber: true })}
                />
                <span className="gr-help">Plage normale : 110-160 bpm.</span>
                {form.formState.errors.fetalHeartRateBpm && (
                  <div className="gr-error">
                    {form.formState.errors.fetalHeartRateBpm.message}
                  </div>
                )}
              </div>
            )}

            {showHu && (
              <div className="gr-field">
                <label htmlFor="grv-hu" className="gr-label">
                  HU — Hauteur utérine (cm)
                </label>
                <Input
                  id="grv-hu"
                  type="number"
                  step="0.1"
                  min={5}
                  max={50}
                  placeholder={`~ ${Math.max(0, sa - 4)} cm attendu`}
                  {...form.register('fundalHeightCm', { valueAsNumber: true })}
                />
                {form.formState.errors.fundalHeightCm && (
                  <div className="gr-error">
                    {form.formState.errors.fundalHeightCm.message}
                  </div>
                )}
              </div>
            )}

            {showMaf && (
              <div className="gr-field">
                <span className="gr-label">MAF — Mouvements actifs fœtaux</span>
                <div className="gr-checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      {...form.register('fetalMovementsPerceived')}
                    />
                    Perçus par la patiente
                  </label>
                </div>
              </div>
            )}

            {showPresentation && (
              <div className="gr-field">
                <label htmlFor="grv-presentation" className="gr-label">
                  Présentation
                </label>
                <Select id="grv-presentation" {...form.register('presentation')}>
                  <option value="">—</option>
                  {PRESENTATIONS.map((p) => (
                    <option key={p} value={p}>
                      {PRESENTATION_LABEL[p]}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="gr-field">
              <label htmlFor="grv-notes" className="gr-label">
                Notes
              </label>
              <Textarea id="grv-notes" rows={3} {...form.register('notes')} />
            </div>
          </form>

          <div className="gr-drawer-footer">
            <Button
              type="submit"
              form="grossesse-visit-form"
              variant="primary"
              disabled={recordVisit.isPending}
              style={{ flex: 1 }}
            >
              {recordVisit.isPending ? 'Enregistrement…' : 'Enregistrer la visite'}
            </Button>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost">
                Annuler
              </Button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
