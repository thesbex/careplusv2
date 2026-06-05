/**
 * Régression #122 (bug langue) — `useClinicSettings` ne doit interroger
 * /settings/clinic QUE lorsqu'on est authentifié.
 *
 * Bug d'origine : le hook est consommé par I18nProvider / AppearanceProvider,
 * montés AU-DESSUS du gate d'auth (donc aussi sur l'écran de login). Sans
 * garde, la requête partait non authentifiée → 401 → `null` mis en cache 60 s
 * (staleTime). Après une reconnexion (navigation SPA, sans full reload), le
 * cache restait « frais » → la langue / l'apparence cabinet n'étaient jamais
 * relues et l'app retombait en français. Un ctrl-F5 « réparait » uniquement
 * parce que le full reload vidait ce cache.
 *
 * Le gate `enabled: !!accessToken` corrige : aucune requête (donc aucun `null`
 * caché) tant qu'on n'a pas de token ; dès qu'un token apparaît (login), la
 * requête part et lit la vraie langue. Même pattern que useMyAppearanceData.
 *
 * Run: cd frontend && npm test -- useSettings
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useAuthStore } from '@/lib/auth/authStore';

// ── Mock the axios client (le vrai api/client importe transitivement le store) ──
const getMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: { get: getMock, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const CLINIC_AR = {
  id: 'c1', name: 'Cab', address: 'a', city: 'c', phone: 'p',
  email: null, inpe: null, cnom: null, ice: null, rib: null,
  language: 'ar',
};

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useClinicSettings — auth gating (régression langue #122)', () => {
  beforeEach(() => {
    getMock.mockReset();
    // Part d'un état déconnecté (comme l'écran de login).
    useAuthStore.setState({ accessToken: null, user: null });
  });

  it("n'interroge PAS /settings/clinic tant qu'on n'est pas authentifié", async () => {
    getMock.mockResolvedValue({ data: CLINIC_AR });
    const { useClinicSettings } = await import('../useSettings');

    const { result } = renderHook(() => useClinicSettings(), {
      wrapper: makeWrapper(makeQC()),
    });

    // Query désactivée → pas de fetch (donc pas de `null` mis en cache 60 s).
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.settings).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it("lit la langue dès qu'un token apparaît (après login) — pas de null collé", async () => {
    getMock.mockResolvedValue({ data: CLINIC_AR });
    const { useClinicSettings } = await import('../useSettings');

    const { result } = renderHook(() => useClinicSettings(), {
      wrapper: makeWrapper(makeQC()),
    });
    expect(getMock).not.toHaveBeenCalled();

    // Login : un access token apparaît → la requête doit partir et lire la langue.
    act(() => useAuthStore.setState({ accessToken: 'tok' }));

    await waitFor(() => expect(result.current.settings?.language).toBe('ar'));
    expect(getMock).toHaveBeenCalledWith('/settings/clinic');
  });
});
