/**
 * Hook test for usePatient — locks the "Traitement en cours" filter fix.
 *
 * Pre-fix bug : the adapter filtered antecedents by
 * `type === 'TRAITEMENT_CHRONIQUE'`, a value that never appears in the
 * backend AntecedentType enum (MEDICAL/CHIRURGICAL/FAMILIAL/
 * GYNECO_OBSTETRIQUE/HABITUS). PatientContextCard renders the section
 * only when `patient.chronicTreatment` is non-empty, so the section
 * never rendered. Manual walk confirmed it on /consultations/:id with
 * Mohamedd Alami (2 MEDICAMENTEUX_EN_COURS antecedents injected).
 *
 * Fix : filter on the fine-grained AntecedentCategory (ADR-023), which
 * the backend already exposes on AntecedentView as `category`.
 *
 * Run: cd frontend && npm test -- usePatient
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
  useAuthStore: vi.fn(),
}));

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const BASE_PATIENT = {
  id: 'pat-1',
  firstName: 'Mohamedd',
  lastName: 'Alami',
  gender: 'M',
  birthDate: '1968-04-12',
  cin: 'BE 328451',
  phone: '+212 6 00 00 00 00',
  email: null,
  bloodGroup: 'A+',
  allergies: [],
  createdAt: '2026-04-01T00:00:00Z',
};

describe('usePatient adapter — Traitement en cours filter', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  it('routes MEDICAMENTEUX_EN_COURS antecedents to chronicTreatment', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ...BASE_PATIENT,
        antecedents: [
          {
            id: 'a1',
            type: 'MEDICAL',
            description: 'Amlodipine 5 mg — 1 cp matin',
            category: 'MEDICAMENTEUX_EN_COURS',
          },
          {
            id: 'a2',
            type: 'MEDICAL',
            description: 'Atorvastatine 20 mg — 1 cp soir',
            category: 'MEDICAMENTEUX_EN_COURS',
          },
          {
            id: 'a3',
            type: 'MEDICAL',
            description: 'HTA depuis 2018',
            category: 'PERSONNEL_MALADIES_CHRONIQUES',
          },
        ],
      },
    });

    const { usePatient } = await import('../usePatient');
    const { result } = renderHook(() => usePatient('pat-1'), {
      wrapper: wrapper(makeQC()),
    });

    await waitFor(() => expect(result.current.patient).not.toBeNull());

    const p = result.current.patient!;
    expect(p.chronicTreatment).toBe(
      'Amlodipine 5 mg — 1 cp matin\nAtorvastatine 20 mg — 1 cp soir',
    );
    // HTA is a chronic disease, not an ongoing treatment — must stay out of chronicTreatment.
    expect(p.chronicTreatment).not.toContain('HTA');
    expect(p.antecedents).toBe('HTA depuis 2018');
  });

  it('chronicTreatment empty when no MEDICAMENTEUX_EN_COURS antecedent exists', async () => {
    getMock.mockResolvedValueOnce({
      data: {
        ...BASE_PATIENT,
        antecedents: [
          { id: 'a1', type: 'MEDICAL', description: 'HTA', category: 'PERSONNEL_MALADIES_CHRONIQUES' },
          { id: 'a2', type: 'CHIRURGICAL', description: 'Appendicectomie 2010', category: 'PERSONNEL_CHIRURGIES' },
        ],
      },
    });

    const { usePatient } = await import('../usePatient');
    const { result } = renderHook(() => usePatient('pat-1'), {
      wrapper: wrapper(makeQC()),
    });

    await waitFor(() => expect(result.current.patient).not.toBeNull());

    const p = result.current.patient!;
    expect(p.chronicTreatment).toBe('');
    expect(p.antecedents).toBe('HTA\nAppendicectomie 2010');
  });

  it('ignores legacy TRAITEMENT_CHRONIQUE on type (no such enum value)', async () => {
    // Regression guard : pre-fix the adapter would have matched on this string
    // even though it never appears in any backend response. Keep the assertion
    // so a future revert can't silently bring the dead filter back.
    getMock.mockResolvedValueOnce({
      data: {
        ...BASE_PATIENT,
        antecedents: [
          {
            id: 'a1',
            type: 'TRAITEMENT_CHRONIQUE',
            description: 'Should NOT leak into chronicTreatment',
            category: null,
          },
        ],
      },
    });

    const { usePatient } = await import('../usePatient');
    const { result } = renderHook(() => usePatient('pat-1'), {
      wrapper: wrapper(makeQC()),
    });

    await waitFor(() => expect(result.current.patient).not.toBeNull());

    expect(result.current.patient!.chronicTreatment).toBe('');
  });
});
