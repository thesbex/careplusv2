/**
 * V038 — hooks queue traitements internes (LAB / RADIO).
 *
 * Backend :
 *   GET    /api/internal-requests?service=LAB&status=PENDING
 *   POST   /api/internal-requests/{id}/claim
 *   POST   /api/internal-requests/{id}/cancel
 *
 * Le service est porté par l'URL (param ?service=LAB|RADIO) ; le statut filtre
 * la queue (PENDING par défaut, IN_PROGRESS pour "en cours", DONE pour
 * historique).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type InternalService = 'LAB' | 'RADIO';
export type InternalStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface InternalRequestRow {
  lineId: string;
  prescriptionId: string;
  testName: string | null;
  patientName: string | null;
  doctorName: string | null;
  status: InternalStatus;
  assignedAt: string | null;
  claimedBy: string | null;
  /** V015 — id du document résultat (DONE seulement). Drive le bouton "Voir". */
  resultDocumentId: string | null;
}

const KEY = 'internal-requests';

export function useInternalRequests(service: InternalService, status: InternalStatus) {
  const { data, isLoading, error } = useQuery({
    queryKey: [KEY, service, status],
    queryFn: () =>
      api
        .get<InternalRequestRow[]>('/internal-requests', { params: { service, status } })
        .then((r) => r.data),
    staleTime: 10_000,
  });
  return {
    rows: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger la queue.' : null,
  };
}

export function useClaimInternalRequest() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (lineId: string) =>
      api.post<InternalRequestRow>(`/internal-requests/${lineId}/claim`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
  return { claim: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useCancelInternalRequest() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (lineId: string) =>
      api.post<InternalRequestRow>(`/internal-requests/${lineId}/cancel`).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [KEY] });
    },
  });
  return { cancel: mutation.mutateAsync, isPending: mutation.isPending };
}
