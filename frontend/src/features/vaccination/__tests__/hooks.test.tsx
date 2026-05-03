/**
 * Pure hook tests for the vaccination module.
 * These tests need the real API client (mocked via vi.mock) and must NOT
 * be in the same file as the component tests which override the hooks.
 *
 * Run: npm test -- --run features/vaccination
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mock the axios client ──────────────────────────────────────────────────

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {
    get: getMock,
    post: postMock,
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock auth store (needed transitively by some hooks)
vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(),
}));

import type { VaccinationCalendarEntry } from '../types';

const MOCK_DOSE: VaccinationCalendarEntry = {
  id: 'dose-1',
  scheduleDoseId: 'sched-1',
  vaccineId: 'vax-1',
  vaccineCode: 'BCG',
  vaccineName: 'BCG',
  doseNumber: 1,
  doseLabel: 'Naissance D1',
  targetDate: '2024-01-01',
  toleranceDays: 30,
  status: 'ADMINISTERED',
  administeredAt: '2024-01-02T10:00:00Z',
  lotNumber: 'LOT-ABC',
  route: 'ID',
  site: 'Deltoïde G',
  administeredByName: 'Dr. Alami',
  deferralReason: null,
  notes: null,
  version: 1,
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

// ── useVaccinationCalendar ────────────────────────────────────────────────────

describe('useVaccinationCalendar', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('returns calendar entries when patientId is provided', async () => {
    getMock.mockResolvedValueOnce({ data: [MOCK_DOSE] });

    const { useVaccinationCalendar } = await import('../hooks/useVaccinationCalendar');
    const qc = makeQC();

    const { result } = renderHook(() => useVaccinationCalendar('patient-1'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.calendar).toHaveLength(1);
    expect(result.current.calendar[0]?.vaccineCode).toBe('BCG');
    expect(result.current.error).toBeNull();
    expect(getMock).toHaveBeenCalledWith('/patients/patient-1/vaccinations');
  });

  it('returns empty array and no loading when patientId is undefined', async () => {
    const { useVaccinationCalendar } = await import('../hooks/useVaccinationCalendar');
    const qc = makeQC();

    const { result } = renderHook(() => useVaccinationCalendar(undefined), {
      wrapper: makeWrapper(qc),
    });

    // Query is disabled when patientId is undefined — should not fetch
    expect(result.current.isLoading).toBe(false);
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.calendar).toHaveLength(0);
  });

  it('returns error string on API failure', async () => {
    getMock.mockRejectedValueOnce(new Error('Network error'));

    const { useVaccinationCalendar } = await import('../hooks/useVaccinationCalendar');
    const qc = makeQC();

    const { result } = renderHook(() => useVaccinationCalendar('patient-err'), {
      wrapper: makeWrapper(qc),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatch(/Impossible de charger/);
  });
});

// ── useRecordDose ─────────────────────────────────────────────────────────────

describe('useRecordDose', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('calls POST /api/patients/:id/vaccinations with correct body', async () => {
    postMock.mockResolvedValueOnce({ data: MOCK_DOSE });

    const { useRecordDose } = await import('../hooks/useRecordDose');
    const qc = makeQC();

    const { result } = renderHook(() => useRecordDose('patient-1'), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.mutateAsync({
        vaccineId: 'vax-1',
        doseNumber: 1,
        administeredAt: '2024-01-02T10:00:00Z',
        lotNumber: 'LOT-ABC',
      });
    });

    expect(postMock).toHaveBeenCalledWith(
      '/patients/patient-1/vaccinations',
      expect.objectContaining({ lotNumber: 'LOT-ABC' }),
    );
  });
});

// ── useDownloadBooklet ─────────────────────────────────────────────────────────

describe('useDownloadBooklet', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('fetches the booklet as arraybuffer and opens a blob URL', async () => {
    const pdfBytes = new ArrayBuffer(8);
    getMock.mockResolvedValueOnce({ data: pdfBytes });

    const fakeUrl = 'blob:fake-url-booklet';
    const createObjectURL = vi.fn(() => fakeUrl);
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window, 'URL', {
      writable: true,
      value: { createObjectURL, revokeObjectURL },
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    const { useDownloadBooklet } = await import('../hooks/useDownloadBooklet');
    const qc = makeQC();

    const { result } = renderHook(() => useDownloadBooklet('patient-1'), {
      wrapper: makeWrapper(qc),
    });

    await act(async () => {
      await result.current.download();
    });

    expect(getMock).toHaveBeenCalledWith(
      '/patients/patient-1/vaccinations/booklet',
      { responseType: 'arraybuffer' },
    );
    expect(createObjectURL).toHaveBeenCalled();
    expect(openSpy).toHaveBeenCalledWith(fakeUrl, '_blank');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();

    openSpy.mockRestore();
  });
});
