/**
 * usePractitioners — read-only fetch of active MEDECIN users.
 * Backed by GET /api/practitioners (Wave 1, commit d321ddd).
 *
 * Used by every screen that needs to drive a "doctor selector" off the
 * cabinet's actual practitioner roster :
 *  - Agenda page (filter whose agenda to view)
 *  - AppointmentDrawer / Prise-RDV (assign a practitioner)
 *  - Paramètres > Assignations (admin tooling — handled by another agent)
 *
 * Caching policy:
 *  - 5 min staleTime (the practitioner list barely moves; ADRs land via
 *    the Paramètres screen and trigger an explicit invalidation).
 *  - No refetch on focus — flipping windows shouldn't spam this read.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface PractitionerView {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string | null;
  active: boolean;
}

export function usePractitioners(): {
  data: PractitionerView[];
  isLoading: boolean;
  isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['practitioners'],
    queryFn: () =>
      api.get<PractitionerView[]>('/practitioners').then((r) => r.data),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? [],
    isLoading,
    isError,
  };
}
