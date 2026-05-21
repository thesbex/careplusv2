import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { ApiUnreadCount } from '../api-types';

/**
 * Badge sidebar — total des messages non lus du caller (toutes conversations).
 * Pattern identique à useStockAlertsCount / useVaccinationOverdueCount :
 * polling 30 s, fallback QueryClient désactivé hors Provider.
 */
const FALLBACK_CLIENT = new QueryClient({
  defaultOptions: { queries: { retry: false, enabled: false } },
});

export function useChatUnreadCount(enabled = true): number | undefined {
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
      queryKey: ['chat', 'unread-count'],
      queryFn: () => api.get<ApiUnreadCount>('/chat/unread-count').then((r) => r.data),
      refetchInterval: 30_000,
      staleTime: 25_000,
      enabled: enabled && !isFallback,
    },
    client,
  );

  if (!enabled || isFallback) return undefined;
  return data?.total;
}
