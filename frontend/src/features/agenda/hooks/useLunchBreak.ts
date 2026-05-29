/**
 * Pause déjeuner par médecin (V067).
 *   GET    /api/practitioners/{id}/lunch-break  → { startTime, endTime } | null (204)
 *   PUT    /api/practitioners/{id}/lunch-break  (MEDECIN soi / ADMIN)
 *   DELETE /api/practitioners/{id}/lunch-break
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface LunchBreak {
  /** "HH:mm" */
  startTime: string;
  endTime: string;
}

export function useLunchBreak(practitionerId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['lunch-break', practitionerId],
    enabled: !!practitionerId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LunchBreak | null> => {
      const res = await api.get<LunchBreak | ''>(`/practitioners/${practitionerId}/lunch-break`);
      // 204 No Content → axios renvoie data = '' → pas de pause configurée.
      return res.status === 204 || !res.data ? null : (res.data as LunchBreak);
    },
  });
  return { lunchBreak: query.data ?? null, isLoading: query.isLoading };
}

export function useSetLunchBreak(practitionerId: string | null | undefined) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (body: LunchBreak) =>
      api.put<LunchBreak>(`/practitioners/${practitionerId}/lunch-break`, body).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lunch-break', practitionerId] });
    },
  });
  return { setLunchBreak: m.mutateAsync, isPending: m.isPending };
}

export function useClearLunchBreak(practitionerId: string | null | undefined) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.delete(`/practitioners/${practitionerId}/lunch-break`).then(() => undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['lunch-break', practitionerId] });
    },
  });
  return { clearLunchBreak: m.mutateAsync, isPending: m.isPending };
}
