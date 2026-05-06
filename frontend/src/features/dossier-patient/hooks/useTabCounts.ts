/**
 * useTabCounts — compteurs des onglets du dossier patient (B6).
 *
 * Avant ce fix, les badges (« Consultations (14) », « Documents (7) », etc.)
 * étaient hard-codés dans `DossierTabs.tsx`. Désormais :
 *  - une seule requête GET /api/patients/{id}/tab-counts agrège tous les
 *    compteurs côté backend (un round-trip),
 *  - le résultat est cache TanStack Query 30 s,
 *  - les mutations qui modifient un compteur invalident la query
 *    `['patient-tab-counts', patientId]` directement (cf. hooks de
 *    consultation, prescription, document, vaccination, grossesse,
 *    invoice, allergie/antécédent).
 *
 * Pendant le chargement initial, on n'affiche pas de badge (le composant
 * teste `count === undefined`) — afficher 0 serait trompeur.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface PatientTabCounts {
  consultations: number;
  prescriptions: number;
  analyses: number;
  imagerie: number;
  documents: number;
  facturation: number;
  vaccinations: number;
  grossesses: number;
}

/** TanStack Query key shared with all mutations that need to invalidate. */
export const tabCountsQueryKey = (patientId: string | undefined) =>
  ['patient-tab-counts', patientId] as const;

export function useTabCounts(patientId: string | undefined): {
  counts: PatientTabCounts | null;
  isLoading: boolean;
  error: string | null;
} {
  const { data, isLoading, error } = useQuery({
    queryKey: tabCountsQueryKey(patientId),
    queryFn: () =>
      api.get<PatientTabCounts>(`/patients/${patientId}/tab-counts`).then((r) => r.data),
    enabled: !!patientId,
    staleTime: 30_000,
  });

  return {
    counts: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger les compteurs.' : null,
  };
}
