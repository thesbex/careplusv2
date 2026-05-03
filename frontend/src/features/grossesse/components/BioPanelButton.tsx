/**
 * BioPanelButton — "Prescrire bilan T1/T2/T3" CTA.
 *
 * Behaviour : on click, fetches the pre-filled `PrescriptionTemplate` for the
 * given trimester. What happens next depends on the call site :
 *
 *   • Inside a consultation context — the parent passes `onTemplateLoaded` ;
 *     the button forwards the loaded template to the existing
 *     PrescriptionDrawer (which requires a `consultationId`).
 *
 *   • At the dossier level (default Étape 5 wiring) — no consultation in
 *     progress. The button opens a read-only `BioPanelPreviewDialog` that
 *     lets the medecin copy the lines to the clipboard or open a real
 *     consultation to issue a signed ordonnance. See the dialog comment for
 *     the rationale (Option D, no standalone backend endpoint yet).
 *
 * RBAC : MEDECIN/ADMIN only. Parent gates rendering ; this component does
 * not enforce it itself.
 */
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Flask } from '@/components/icons';
import { useBioPanelTemplate } from '../hooks/useBioPanelTemplate';
import { BioPanelPreviewDialog } from './BioPanelPreviewDialog';
import type { Trimester } from '../types';
import type { PrescriptionTemplate } from '@/features/parametres/hooks/usePrescriptionTemplates';

interface BioPanelButtonProps {
  pregnancyId: string;
  trimester: Trimester;
  /**
   * Optional consultation-context hook. When provided, the loaded template is
   * propagated to the parent (which typically opens PrescriptionDrawer with
   * the prefill lines) and the standalone preview dialog is NOT shown.
   */
  onTemplateLoaded?: (template: PrescriptionTemplate) => void;
  /** Visual variant — defaults to ghost so several side-by-side. */
  variant?: 'primary' | 'ghost';
}

export function BioPanelButton({
  pregnancyId,
  trimester,
  onTemplateLoaded,
  variant = 'ghost',
}: BioPanelButtonProps) {
  const mutation = useBioPanelTemplate();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedTemplate, setLoadedTemplate] = useState<PrescriptionTemplate | null>(
    null,
  );

  async function handleClick() {
    try {
      const tpl = await mutation.mutateAsync({ pregnancyId, trimester });
      if (onTemplateLoaded) {
        onTemplateLoaded(tpl);
      } else {
        setLoadedTemplate(tpl);
        setPreviewOpen(true);
      }
    } catch {
      toast.error('Impossible de charger le modèle de bilan.');
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size="sm"
        onClick={() => {
          void handleClick();
        }}
        disabled={mutation.isPending}
        aria-label={`Prescrire bilan ${trimester}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      >
        <Flask style={{ width: 13, height: 13 }} />
        {mutation.isPending ? 'Chargement…' : `Bilan ${trimester}`}
      </Button>

      {/* Standalone preview path : only when no consultation-context callback. */}
      {!onTemplateLoaded && (
        <BioPanelPreviewDialog
          open={previewOpen}
          onOpenChange={(o) => {
            setPreviewOpen(o);
            if (!o) setLoadedTemplate(null);
          }}
          template={loadedTemplate}
          trimester={trimester}
        />
      )}
    </>
  );
}
