/**
 * Hook tests for useTabCounts (B6).
 *
 * Run: cd frontend && npm test -- useTabCounts
 *
 * Couvert :
 *  - le hook appelle GET /patients/{id}/tab-counts avec le bon patientId
 *  - les badges affichent les valeurs reçues (via DossierTabs)
 *  - loading state : `counts` est null tant que la requête n'a pas répondu
 *    (le composant DossierTabs n'affiche aucun badge)
 *  - patientId undefined : pas de fetch (hook désactivé)
 *  - invalidation : un Mutation qui invalide ['patient-tab-counts', id]
 *    déclenche un re-fetch du hook
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mock the axios client ──────────────────────────────────────────────────

const getMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {
    get: getMock,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock auth store (transitively imported by api client interceptor)
vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(),
}));

const SAMPLE_COUNTS = {
  consultations: 3,
  prescriptions: 5,
  analyses: 2,
  imagerie: 1,
  documents: 4,
  facturation: 7,
  vaccinations: 6,
  grossesses: 1,
};

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useTabCounts', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('calls GET /patients/:id/tab-counts and returns the counts', async () => {
    getMock.mockResolvedValueOnce({ data: SAMPLE_COUNTS });

    const { useTabCounts } = await import('../useTabCounts');
    const qc = makeQC();

    const { result } = renderHook(() => useTabCounts('patient-1'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(getMock).toHaveBeenCalledWith('/patients/patient-1/tab-counts');
    expect(result.current.counts).toEqual(SAMPLE_COUNTS);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch when patientId is undefined', async () => {
    const { useTabCounts } = await import('../useTabCounts');
    const qc = makeQC();

    const { result } = renderHook(() => useTabCounts(undefined), {
      wrapper: makeWrapper(qc),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.counts).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('returns counts: null while loading (so badges stay hidden)', async () => {
    // Never-resolving promise to keep query in loading state.
    let resolve: (v: { data: typeof SAMPLE_COUNTS }) => void = () => {};
    getMock.mockReturnValueOnce(
      new Promise<{ data: typeof SAMPLE_COUNTS }>((r) => {
        resolve = r;
      }),
    );

    const { useTabCounts } = await import('../useTabCounts');
    const qc = makeQC();

    const { result } = renderHook(() => useTabCounts('patient-x'), {
      wrapper: makeWrapper(qc),
    });

    // Pending → counts null, isLoading true
    expect(result.current.counts).toBeNull();
    expect(result.current.isLoading).toBe(true);

    // Cleanup so the test doesn't leak the promise.
    resolve({ data: SAMPLE_COUNTS });
  });

  it('surfaces a French error message on failure', async () => {
    getMock.mockRejectedValueOnce(new Error('boom'));

    const { useTabCounts } = await import('../useTabCounts');
    const qc = makeQC();

    const { result } = renderHook(() => useTabCounts('patient-err'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatch(/Impossible de charger/);
    expect(result.current.counts).toBeNull();
  });

  it('refetches after a mutation invalidates ["patient-tab-counts", id]', async () => {
    // First call returns initial counts, second call returns incremented counts.
    getMock
      .mockResolvedValueOnce({ data: SAMPLE_COUNTS })
      .mockResolvedValueOnce({ data: { ...SAMPLE_COUNTS, consultations: 4 } });

    const { useTabCounts } = await import('../useTabCounts');
    const qc = makeQC();

    // Combined hook: read counts + a mutation that invalidates tab-counts on success.
    const { result } = renderHook(
      () => {
        const counts = useTabCounts('patient-1');
        const queryClient = useQueryClient();
        const mut = useMutation({
          mutationFn: () => Promise.resolve(),
          onSuccess: () => {
            void queryClient.invalidateQueries({
              queryKey: ['patient-tab-counts', 'patient-1'],
            });
          },
        });
        return { counts, mut };
      },
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.counts.counts?.consultations).toBe(3));
    expect(getMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.mut.mutateAsync();
    });

    await waitFor(() => expect(result.current.counts.counts?.consultations).toBe(4));
    expect(getMock).toHaveBeenCalledTimes(2);
  });
});

// ── Component-level smoke: badges render the values from useTabCounts ──────

describe('DossierTabs badges (integration with useTabCounts)', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('renders numeric badges for counted tabs once data is loaded', async () => {
    getMock.mockResolvedValueOnce({ data: SAMPLE_COUNTS });

    const { useTabCounts } = await import('../useTabCounts');
    const { DossierTabs } = await import('../../components/DossierTabs');
    const qc = makeQC();

    function Harness() {
      const { counts } = useTabCounts('patient-1');
      return (
        <DossierTabs value="timeline" onValueChange={() => {}} counts={counts}>
          <div>panel</div>
        </DossierTabs>
      );
    }

    const { container, queryByText } = render(
      <QueryClientProvider client={qc}>
        <Harness />
      </QueryClientProvider>,
    );

    // While loading, badges should not be rendered.
    // The label itself is always present.
    expect(queryByText('Consultations')).not.toBeNull();

    await waitFor(() => {
      // After fetch resolves, badge "3" appears next to Consultations.
      expect(container.textContent).toContain('Consultations');
      expect(container.textContent).toContain('3');
      expect(container.textContent).toContain('Prescriptions');
      expect(container.textContent).toContain('5');
      expect(container.textContent).toContain('Documents');
      expect(container.textContent).toContain('4');
    });
  });
});
