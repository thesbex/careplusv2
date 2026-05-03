/**
 * BioPanelButton — "Prescrire bilan T1/T2/T3" CTA.
 *
 * Behaviour : on click, fetches the pre-filled `PrescriptionTemplate` for the
 * given trimester, then signals the parent to open the existing
 * PrescriptionDrawer with those lines hydrated.
 *
 * Why a callback rather than rendering PrescriptionDrawer here :
 * the existing PrescriptionDrawer requires a `consultationId`. The dossier-
 * level button does NOT have one (no consultation in progress). So the
 * button only fetches the template ; the parent decides what to do :
 *   - inside a consultation context → open the drawer with prefill lines
 *   - inside the dossier (no consult) → toast "démarrer une consultation"
 *
 * RBAC : MEDECIN/ADMIN only. Parent gates rendering ; this component does
 * not enforce it itself.
 */
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Flask } from '@/components/icons';
import { useBioPanelTemplate } from '../hooks/useBioPanelTemplate';
import type { Trimester } from '../types';
import type { PrescriptionTemplate } from '@/features/parametres/hooks/usePrescriptionTemplates';

interface BioPanelButtonProps {
  pregnancyId: string;
  trimester: Trimester;
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

  async function handleClick() {
    try {
      const tpl = await mutation.mutateAsync({ pregnancyId, trimester });
      if (onTemplateLoaded) {
        onTemplateLoaded(tpl);
      } else {
        toast.info(`Modèle ${trimester} chargé (${tpl.lines.length} lignes).`, {
          description: 'Ouvrez une consultation pour finaliser la prescription.',
        });
      }
    } catch {
      toast.error('Impossible de charger le modèle de bilan.');
    }
  }

  return (
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
  );
}
