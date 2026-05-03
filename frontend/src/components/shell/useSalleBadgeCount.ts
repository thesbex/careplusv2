import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

/**
 * Live count of patients physically in the waiting room — used by `<Screen>`
 * and `<MScreen>` to render the badge on the "Salle d'attente" nav item.
 *
 * Avant 2026-05-01 ce badge était hardcodé à 3 dans le default des shells
 * (`counts = { salle: 3 }`), donc il s'affichait sur toutes les pages même
 * quand la salle était vide.
 *
 * Partage la même `queryKey: ['queue']` que `useQueue()` — un seul appel
 * réseau quand la SalleAttentePage et le shell coexistent.
 *
 * Resilience tests : certains tests unitaires rendent `<MScreen>` /
 * `<Screen>` sans `QueryClientProvider`. On retombe sur un client local
 * désactivé pour ne PAS faire crasher le rendu (le badge n'est juste pas
 * affiché). En prod, App.tsx wrappe toujours dans un provider.
 */
const FALLBACK_CLIENT = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

export function useSalleBadgeCount(enabled = true): number | undefined {
  // The try/catch is safe here despite the rules-of-hooks lint :
  // `useQueryClient` is called unconditionally on every render — the catch
  // only suppresses the deterministic "no provider" throw so a few unit
  // tests that render `<MScreen>` without a `QueryClientProvider` (e.g.
  // DossierPage.mobile.test) don't crash. In production App.tsx always
  // provides a client, so this branch is never taken at runtime.
  let providerClient: QueryClient | undefined;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    providerClient = useQueryClient();
  } catch {
    providerClient = undefined;
  }
  const client = providerClient ?? FALLBACK_CLIENT;
  const isFallback = client === FALLBACK_CLIENT;

  const { data } = useQuery(
    {
      queryKey: ['queue'],
      queryFn: () => api.get<unknown[]>('/queue').then((r) => r.data),
      refetchInterval: 15_000,
      staleTime: 10_000,
      enabled: enabled && !isFallback,
    },
    client,
  );

  if (!enabled || isFallback) return undefined;
  return data?.length;
}
