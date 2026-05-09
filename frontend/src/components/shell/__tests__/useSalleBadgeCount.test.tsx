/**
 * useSalleBadgeCount — le badge de la sidebar ne doit compter que les
 * patients PRÉSENTS en salle d'attente. Les EN_CONSULTATION sont exclus :
 * dès qu'un patient part chez le médecin, le badge décrémente même si
 * /queue continue de renvoyer la ligne (la page Salle a besoin de
 * l'afficher avec la pastille "Consultation").
 *
 * Régression couverte : avant 2026-05-09 le badge affichait `data.length`
 * brut, donc envoyer un patient en consult ne décrémentait rien.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn() },
}));

import { api } from '@/lib/api/client';
import { useSalleBadgeCount } from '../useSalleBadgeCount';

const apiMock = api as unknown as { get: ReturnType<typeof vi.fn> };

function withClient(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children: c }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{c ?? children}</QueryClientProvider>
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
});

describe('useSalleBadgeCount', () => {
  it('compte les patients présents (ARRIVE / CONSTANTES_PRISES) et exclut les EN_CONSULTATION', async () => {
    apiMock.get.mockResolvedValue({
      data: [
        { status: 'ARRIVE' },
        { status: 'CONSTANTES_PRISES' },
        { status: 'EN_CONSULTATION' }, // parti chez le médecin → ne doit PAS compter
        { status: 'EN_CONSULTATION' },
      ],
    });

    const Wrapper = withClient(null);
    const { result } = renderHook(() => useSalleBadgeCount(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current).toBe(2));
    expect(apiMock.get).toHaveBeenCalledWith('/queue');
  });

  it('retourne 0 quand tous les patients sont en consultation', async () => {
    apiMock.get.mockResolvedValue({
      data: [{ status: 'EN_CONSULTATION' }, { status: 'EN_CONSULTATION' }],
    });

    const Wrapper = withClient(null);
    const { result } = renderHook(() => useSalleBadgeCount(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current).toBe(0));
  });

  it('retourne undefined quand le hook est désactivé', () => {
    const Wrapper = withClient(null);
    const { result } = renderHook(() => useSalleBadgeCount(false), { wrapper: Wrapper });

    expect(result.current).toBeUndefined();
    expect(apiMock.get).not.toHaveBeenCalled();
  });
});
