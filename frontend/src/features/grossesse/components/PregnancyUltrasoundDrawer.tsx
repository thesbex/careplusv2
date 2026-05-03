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
import { RecordUltrasoundSchema, type RecordUltrasoundValues } from '../schemas';
import { useRecordUltrasound } from '../hooks/useRecordUltrasound';
import {
  ULTRASOUND_KIND_LABEL,
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
  const recordUs = useRecordUltrasound(pregnancy.id, pregnancy.patientId);
  const [documentId, setDocumentId] = useState<string | null>(null);

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
      toast.success('Échographie enregistrée.');
      form.reset();
      setDocumentId(null);
      onOpenChange(false);
    } catch {
      toast.error('Impossible d\'enregistrer l\'échographie.');
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
        <Dialog.Content className="gr-drawer" aria-label="Saisir une échographie">
          <div className="gr-drawer-header">
            <Dialog.Title className="gr-drawer-title">Saisir une échographie</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
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
                Type d&apos;échographie *
              </label>
              <Select id="grus-kind" {...form.register('kind')}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ULTRASOUND_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>

            <div className="gr-field">
              <label htmlFor="grus-performedAt" className="gr-label">
                Date *
              </label>
              <Input
                id="grus-performedAt"
                type="date"
                max={toLocalDate(new Date())}
                {...form.register('performedAt')}
              />
              {form.formState.errors.performedAt && (
                <div className="gr-error">
                  {form.formState.errors.performedAt.message}
                </div>
              )}
            </div>

            <div className="gr-grid-2">
              <div className="gr-field">
                <label htmlFor="grus-saw" className="gr-label">
                  SA semaines *
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
                    {form.formState.errors.saWeeksAtExam.message}
                  </div>
                )}
              </div>
              <div className="gr-field">
                <label htmlFor="grus-sad" className="gr-label">
                  SA jours
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
                    {form.formState.errors.saDaysAtExam.message}
                  </div>
                )}
              </div>
            </div>

            <div className="gr-field">
              <span className="gr-label">Biométrie (mm / pourcentile)</span>
              <div className="gr-grid-2">
                <Input
                  type="number"
                  step="0.1"
                  placeholder="BIP"
                  aria-label="BIP — Diamètre bipariétal"
                  {...form.register('biometry.bip', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="PC"
                  aria-label="PC — Périmètre crânien"
                  {...form.register('biometry.pc', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="DAT"
                  aria-label="DAT — Diamètre abdominal transverse"
                  {...form.register('biometry.dat', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="0.1"
                  placeholder="LF"
                  aria-label="LF — Longueur fémorale"
                  {...form.register('biometry.lf', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="1"
                  placeholder="EG (g) — poids estimé"
                  aria-label="Poids estimé fœtal"
                  {...form.register('biometry.eg', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  step="1"
                  min={0}
                  max={100}
                  placeholder="Percentile"
                  aria-label="Percentile"
                  {...form.register('biometry.percentile', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="gr-field">
              <label htmlFor="grus-findings" className="gr-label">
                Compte-rendu (résumé)
              </label>
              <Textarea
                id="grus-findings"
                rows={4}
                placeholder="Conclusions, anomalies éventuelles…"
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
                  Corriger la DPA (échographie de datation)
                </label>
                <span className="gr-help">
                  Ajuste la DPA selon la mesure CRL et recalcule le plan de visites.
                </span>
              </div>
            )}

            <div className="gr-field">
              <span className="gr-label">Compte-rendu PDF (optionnel)</span>
              <DocumentUploadButton
                accept="application/pdf,image/*"
                uploadLabel={documentId ? 'Document attaché' : 'Téléverser le compte-rendu'}
                onFile={(_file) => {
                  // Document upload route lives outside scope of Étape 4 — left
                  // as a stub callback. Étape 5 wires DocumentUploadButton to
                  // /patients/:id/documents and surfaces the returned id.
                  toast.info('Téléversement de documents : fonctionnalité disponible prochainement.');
                }}
              />
              {documentId && (
                <span className="gr-help">Document attaché : {documentId}</span>
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
              {recordUs.isPending ? 'Enregistrement…' : 'Enregistrer l\'écho'}
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
