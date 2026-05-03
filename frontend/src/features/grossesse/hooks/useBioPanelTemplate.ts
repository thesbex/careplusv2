import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  PrescriptionTemplate,
} from '@/features/parametres/hooks/usePrescriptionTemplates';
import type { Trimester } from '../types';

/**
 * GET /api/pregnancies/:id/bio-panel-template?trimester=T1|T2|T3
 *
 * Returns a `PrescriptionTemplate` pre-filled with the bilan biologique for
 * the given trimester (PSGA aligned). Lazy: triggered on button click via
 * `mutateAsync({ pregnancyId, trimester })` so the parent component decides
 * what to do with the lines (typically: hand them to PrescriptionDrawer).
 */
export function useBioPanelTemplate() {
  return useMutation({
    mutationFn: ({
      pregnancyId,
      trimester,
    }: {
      pregnancyId: string;
      trimester: Trimester;
    }) =>
      api
        .get<PrescriptionTemplate>(
          `/pregnancies/${pregnancyId}/bio-panel-template`,
          { params: { trimester } },
        )
        .then((r) => r.data),
  });
}
