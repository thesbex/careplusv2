/**
 * Hook tests for useAvailability + useMonthAvailability — secrétaire bug.
 *
 * Pre-fix bug : both hooks hardcoded `practitionerId = useAuthStore(s => s.user?.id)`.
 * When a secrétaire logged in, the query asked for HER own availability —
 * empty by definition, so the RDV form's mini-agenda + slots were greyed out.
 *
 * Fix : both hooks accept an explicit `practitionerId` arg; PriseRDVDialog
 * passes the form's selected practitioner. The previous behavior is preserved
 * as a fallback when the arg is omitted (medecin self-booking).
 *
 * Run: cd frontend && npm test -- useAvailability
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const getMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {
    get: getMock,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'secretary-user-id' } }),
}));

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(qc: QueryClient) {
  return function W({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

describe('useAvailability — secrétaire fix', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: [] });
  });

  it('uses the explicit practitionerId when provided (secrétaire path)', async () => {
    const { useAvailability } = await import('../useAvailability');
    renderHook(() => useAvailability('15/05/2026', 30, 'doctor-bennani'), {
      wrapper: wrap(makeQC()),
    });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    const url = getMock.mock.calls[0]![0] as string;
    expect(url).toContain('practitionerId=doctor-bennani');
    expect(url).not.toContain('practitionerId=secretary-user-id');
  });

  it('falls back to the logged-in user when no practitionerId is passed (medecin self-booking)', async () => {
    const { useAvailability } = await import('../useAvailability');
    renderHook(() => useAvailability('15/05/2026', 30), { wrapper: wrap(makeQC()) });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    const url = getMock.mock.calls[0]![0] as string;
    expect(url).toContain('practitionerId=secretary-user-id');
  });

  it('explicit null falls back to the logged-in user too', async () => {
    const { useAvailability } = await import('../useAvailability');
    renderHook(() => useAvailability('15/05/2026', 30, null), { wrapper: wrap(makeQC()) });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    const url = getMock.mock.calls[0]![0] as string;
    expect(url).toContain('practitionerId=secretary-user-id');
  });
});

describe('useMonthAvailability — secrétaire fix', () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue({ data: [] });
  });

  it('uses the explicit practitionerId when provided', async () => {
    const { useMonthAvailability } = await import('../useMonthAvailability');
    renderHook(() => useMonthAvailability(2026, 4, 30, 'doctor-bennani'), {
      wrapper: wrap(makeQC()),
    });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    const url = getMock.mock.calls[0]![0] as string;
    expect(url).toContain('practitionerId=doctor-bennani');
    expect(url).not.toContain('practitionerId=secretary-user-id');
  });

  it('falls back to the logged-in user when no practitionerId is passed', async () => {
    const { useMonthAvailability } = await import('../useMonthAvailability');
    renderHook(() => useMonthAvailability(2026, 4, 30), { wrapper: wrap(makeQC()) });
    await waitFor(() => expect(getMock).toHaveBeenCalled());
    const url = getMock.mock.calls[0]![0] as string;
    expect(url).toContain('practitionerId=secretary-user-id');
  });
});
