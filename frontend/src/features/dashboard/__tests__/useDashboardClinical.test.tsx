/**
 * Tests for useDashboardClinical.
 *
 * Run :
 *   cd frontend && npm test -- dashboard --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Module mocks ────────────────────────────────────────────────────────────
const apiGetMock = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

const useAuthStoreMock = vi.fn();
vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => useAuthStoreMock(selector),
}));

import { useDashboardClinical } from '../hooks/useDashboardClinical';
import type { ClinicalDashboardView } from '../types';

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function withQC(qc: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const FIXTURE: ClinicalDashboardView = {
  patientsActifsTotal: 1240,
  patientsActifs30j: 318,
  consultationsAujourdhui: 14,
  consultationsSemaine: 62,
  consultationsMois: 240,
  ageMoyenPatientele: 38,
  topPathologies: [
    { code: 'I10', label: 'HTA', count: 102 },
    { code: 'E11', label: 'Diabète type 2', count: 48 },
  ],
  activite7j: [
    { date: '2026-04-30', count: 10 },
    { date: '2026-05-01', count: 12 },
  ],
  activite30j: [],
};

describe('useDashboardClinical', () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    useAuthStoreMock.mockReset();
  });

  it('fetches /api/dashboard/clinical and exposes the view (MEDECIN)', async () => {
    useAuthStoreMock.mockImplementation(
      (selector: (s: { user: { roles: string[] } }) => unknown) =>
        selector({ user: { roles: ['MEDECIN'] } }),
    );
    apiGetMock.mockResolvedValueOnce({ data: FIXTURE });

    const qc = makeQC();
    const { result } = renderHook(() => useDashboardClinical(), {
      wrapper: withQC(qc),
    });

    expect(result.current.isEnabled).toBe(true);
    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });
    expect(apiGetMock).toHaveBeenCalledWith('/dashboard/clinical');
    expect(result.current.data?.patientsActifsTotal).toBe(1240);
    expect(result.current.error).toBeNull();
  });

  it('is disabled (no fetch) for SECRETAIRE — clinical block is BE-gated', () => {
    useAuthStoreMock.mockImplementation(
      (selector: (s: { user: { roles: string[] } }) => unknown) =>
        selector({ user: { roles: ['SECRETAIRE'] } }),
    );

    const qc = makeQC();
    const { result } = renderHook(() => useDashboardClinical(), {
      wrapper: withQC(qc),
    });

    expect(result.current.isEnabled).toBe(false);
    expect(apiGetMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeNull();
  });

  it('returns a friendly error message when the request fails', async () => {
    useAuthStoreMock.mockImplementation(
      (selector: (s: { user: { roles: string[] } }) => unknown) =>
        selector({ user: { roles: ['ADMIN'] } }),
    );
    apiGetMock.mockRejectedValueOnce(new Error('boom'));

    const qc = makeQC();
    const { result } = renderHook(() => useDashboardClinical(), {
      wrapper: withQC(qc),
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });
    expect(result.current.error).toMatch(/cliniques/i);
    expect(result.current.data).toBeNull();
  });
});
