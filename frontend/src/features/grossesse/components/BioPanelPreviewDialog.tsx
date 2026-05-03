/**
 * BioPanelPreviewDialog — Étape 5 (Option D).
 *
 * Background : `BioPanelButton` fetches a `PrescriptionTemplate` pre-filled
 * with the bilan biologique for the selected trimester. Inside a consultation
 * context, that template would be handed to `PrescriptionDrawer` (which
 * requires a `consultationId`). At the dossier level, no consultation is in
 * progress, so we cannot create a real signed prescription.
 *
 * Decision : Option D (commit message of Étape 5).
 *   The backend has no `/api/patients/{id}/prescriptions/standalone` endpoint
 *   today (only `/api/consultations/{consultationId}/prescriptions`). Adding
 *   one is a separate backend change tracked in BACKLOG as
 *   "Prescription standalone hors consultation" (would unlock Option C).
 *
 *   For Étape 5 we ship a read-only preview dialog : the medecin can copy the
 *   formatted lines to the clipboard (paste into a paper ordonnance, the EHR
 *   of the lab, etc.) or open a consultation to issue a real signed
 *   ordonnance. No silent state mutation.
 */
import { useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Close, Clipboard } from '@/components/icons';
import type {
  PrescriptionTemplate,
  DrugTemplateLine,
  LabTemplateLine,
  ImagingTemplateLine,
} from '@/features/parametres/hooks/usePrescriptionTemplates';
import type { Trimester } from '../types';

interface BioPanelPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: PrescriptionTemplate | null;
  trimester: Trimester;
}

function formatLine(
  line: DrugTemplateLine | LabTemplateLine | ImagingTemplateLine,
  type: PrescriptionTemplate['type'],
): string {
  if (type === 'DRUG') {
    const d = line as DrugTemplateLine;
    const parts = [d.medicationCode];
    if (d.dosage) parts.push(d.dosage);
    if (d.frequency) parts.push(d.frequency);
    if (d.duration) parts.push(d.duration);
    if (d.quantity != null) parts.push(`x${d.quantity}`);
    if (d.instructions) parts.push(`(${d.instructions})`);
    return parts.join(' — ');
  }
  if (type === 'LAB') {
    const l = line as LabTemplateLine;
    return l.instructions ? `${l.labTestCode} (${l.instructions})` : l.labTestCode;
  }
  const im = line as ImagingTemplateLine;
  return im.instructions ? `${im.imagingExamCode} (${im.instructions})` : im.imagingExamCode;
}

export function BioPanelPreviewDialog({
  open,
  onOpenChange,
  template,
  trimester,
}: BioPanelPreviewDialogProps) {
  const formattedLines = useMemo(() => {
    if (!template) return [] as string[];
    return template.lines.map((l) => formatLine(l, template.type));
  }, [template]);

  async function handleCopy() {
    if (formattedLines.length === 0) return;
    const text = formattedLines.map((l, i) => `${i + 1}. ${l}`).join('\n');
    try {
      // navigator.clipboard is gated to https / localhost contexts.
      // jsdom in tests defines `navigator.clipboard` only when polyfilled; we
      // guard on existence to surface a useful error otherwise.
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success(`${formattedLines.length} lignes copiées.`);
      } else {
        toast.error('Presse-papiers indisponible dans ce navigateur.');
      }
    } catch {
      toast.error('Copie impossible.');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="gr-overlay" />
        <Dialog.Content
          className="gr-dialog"
          aria-label={`Aperçu du bilan ${trimester}`}
          data-testid="bio-panel-preview"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Dialog.Title style={{ fontSize: 14.5, fontWeight: 600, flex: 1, margin: 0 }}>
              Bilan biologique {trimester}
              {template ? (
                <span
                  style={{
                    fontSize: 11.5,
                    color: 'var(--ink-3)',
                    marginLeft: 8,
                    fontWeight: 400,
                  }}
                >
                  {formattedLines.length} ligne{formattedLines.length !== 1 ? 's' : ''}
                </span>
              ) : null}
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm" iconOnly aria-label="Fermer">
                <Close />
              </Button>
            </Dialog.Close>
          </div>

          <Dialog.Description
            style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12 }}
          >
            Modèle PSGA pré-rempli (sérologies + bilans) pour le trimestre{' '}
            <strong>{trimester}</strong>. Copiez les lignes ou ouvrez une
            consultation pour émettre une ordonnance signée.
          </Dialog.Description>

          {template == null || formattedLines.length === 0 ? (
            <div
              style={{
                fontSize: 13,
                color: 'var(--ink-3)',
                padding: '20px 0',
                textAlign: 'center',
              }}
            >
              Aucun modèle disponible pour {trimester}.
            </div>
          ) : (
            <ol
              data-testid="bio-panel-lines"
              style={{
                listStyle: 'decimal',
                paddingLeft: 22,
                margin: 0,
                maxHeight: 320,
                overflowY: 'auto',
                fontSize: 13,
                lineHeight: 1.55,
                color: 'var(--ink)',
                background: 'var(--bg-alt, var(--surface-2))',
                borderRadius: 'var(--r-sm)',
                padding: '12px 14px 12px 34px',
                border: '1px solid var(--border)',
              }}
            >
              {formattedLines.map((line, i) => (
                <li key={i} style={{ marginBottom: i === formattedLines.length - 1 ? 0 : 4 }}>
                  {line}
                </li>
              ))}
            </ol>
          )}

          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              marginTop: 14,
            }}
          >
            <Dialog.Close asChild>
              <Button type="button" variant="ghost">
                Fermer
              </Button>
            </Dialog.Close>
            <Button
              type="button"
              variant="primary"
              disabled={formattedLines.length === 0}
              onClick={() => {
                void handleCopy();
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Clipboard style={{ width: 14, height: 14 }} />
              Copier les lignes
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
