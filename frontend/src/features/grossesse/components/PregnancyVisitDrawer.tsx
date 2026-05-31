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
import { useT } from '@/lib/i18n/I18nProvider';
import { RecordVisitSchema, type RecordVisitValues } from '../schemas';
import { useRecordVisit } from '../hooks/useRecordVisit';
import { PRESENTATION_LABEL_KEY, type Presentation, type Pregnancy } from '../types';

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
  const { t } = useT();
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
      toast.success(t('gross.visit.success'));
      form.reset();
      onOpenChange(false);
    } catch {
      toast.error(t('gross.visit.error'));
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
        <Dialog.Content className="gr-drawer" aria-label={t('gross.action.recordVisitMobile')}>
          <div className="gr-drawer-header">
            <Dialog.Title className="gr-drawer-title">
              {t('gross.visit.title', { sa })}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label={t('common.close')}>
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
                {t('gross.visit.dateTimeLabel')}
              </label>
              <Input
                id="grv-recordedAt"
                type="datetime-local"
                {...form.register('recordedAt')}
              />
              {form.formState.errors.recordedAt && (
                <div className="gr-error">
                  {t(form.formState.errors.recordedAt.message ?? '')}
                </div>
              )}
            </div>

            <div className="gr-grid-2">
              <div className="gr-field">
                <label htmlFor="grv-weightKg" className="gr-label">
                  {t('gross.visit.weightLabel')}
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
                    {t(form.formState.errors.weightKg.message ?? '')}
                  </div>
                )}
              </div>
              <div />
            </div>

            <div className="gr-field">
              <span className="gr-label">{t('gross.visit.taLabel')}</span>
              <div className="gr-grid-2">
                <Input
                  type="number"
                  min={60}
                  max={220}
                  placeholder={t('gross.visit.taSysPlaceholder')}
                  aria-label={t('gross.visit.taSysAria')}
                  {...form.register('bpSystolic', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  min={30}
                  max={140}
                  placeholder={t('gross.visit.taDiaPlaceholder')}
                  aria-label={t('gross.visit.taDiaAria')}
                  {...form.register('bpDiastolic', { valueAsNumber: true })}
                />
              </div>
              {(form.formState.errors.bpSystolic ?? form.formState.errors.bpDiastolic) && (
                <div className="gr-error">
                  {t(
                    form.formState.errors.bpSystolic?.message ??
                      form.formState.errors.bpDiastolic?.message ??
                      '',
                  )}
                </div>
              )}
            </div>

            <fieldset className="gr-field" style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend className="gr-label">{t('gross.visit.urineDip')}</legend>
              <div className="gr-checkbox-row" data-testid="urine-dip-row">
                {(
                  [
                    ['glucose', 'gross.visit.urine.glucose'],
                    ['protein', 'gross.visit.urine.protein'],
                    ['leuco', 'gross.visit.urine.leuco'],
                    ['nitrites', 'gross.visit.urine.nitrites'],
                    ['ketones', 'gross.visit.urine.ketones'],
                    ['blood', 'gross.visit.urine.blood'],
                  ] as const
                ).map(([key, labelKey]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      {...form.register(`urineDip.${key}` as const)}
                    />
                    {t(labelKey)}
                  </label>
                ))}
              </div>
            </fieldset>

            {showBcf && (
              <div className="gr-field">
                <label htmlFor="grv-bcf" className="gr-label">
                  {t('gross.visit.bcfLabel')}
                </label>
                <Input
                  id="grv-bcf"
                  type="number"
                  min={100}
                  max={200}
                  placeholder="140"
                  {...form.register('fetalHeartRateBpm', { valueAsNumber: true })}
                />
                <span className="gr-help">{t('gross.visit.bcfHelp')}</span>
                {form.formState.errors.fetalHeartRateBpm && (
                  <div className="gr-error">
                    {t(form.formState.errors.fetalHeartRateBpm.message ?? '')}
                  </div>
                )}
              </div>
            )}

            {showHu && (
              <div className="gr-field">
                <label htmlFor="grv-hu" className="gr-label">
                  {t('gross.visit.huLabel')}
                </label>
                <Input
                  id="grv-hu"
                  type="number"
                  step="0.1"
                  min={5}
                  max={50}
                  placeholder={t('gross.visit.huPlaceholder', { n: Math.max(0, sa - 4) })}
                  {...form.register('fundalHeightCm', { valueAsNumber: true })}
                />
                {form.formState.errors.fundalHeightCm && (
                  <div className="gr-error">
                    {t(form.formState.errors.fundalHeightCm.message ?? '')}
                  </div>
                )}
              </div>
            )}

            {showMaf && (
              <div className="gr-field">
                <span className="gr-label">{t('gross.visit.mafLabel')}</span>
                <div className="gr-checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      {...form.register('fetalMovementsPerceived')}
                    />
                    {t('gross.visit.mafPerceived')}
                  </label>
                </div>
              </div>
            )}

            {showPresentation && (
              <div className="gr-field">
                <label htmlFor="grv-presentation" className="gr-label">
                  {t('gross.visit.presentationLabel')}
                </label>
                <Select id="grv-presentation" {...form.register('presentation')}>
                  <option value="">—</option>
                  {PRESENTATIONS.map((p) => (
                    <option key={p} value={p}>
                      {t(PRESENTATION_LABEL_KEY[p])}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="gr-field">
              <label htmlFor="grv-notes" className="gr-label">
                {t('gross.visit.notesLabel')}
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
              {recordVisit.isPending ? t('gross.visit.submitting') : t('gross.visit.submit')}
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
