/**
 * Grossesse — compte-rendu PDF d'échographie + téléversement document.
 *
 * Run only this slice :
 *   cd frontend && npx vitest run src/features/grossesse
 *
 * Covers :
 *  - PregnancyTab (desktop) : un bouton "Compte-rendu PDF" par échographie,
 *    le clic appelle GET /pregnancies/:id/ultrasounds/:usId/cr-pdf en blob.
 *  - PregnancyUltrasoundDrawer : onFile du DocumentUploadButton n'affiche plus
 *    le toast "prochainement" — il téléverse via usePatientDocuments et
 *    enregistre le documentId retourné.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const noop = (): void => undefined;

// ── Auth mock — default MEDECIN ─────────────────────────────────────────────
vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(
    (selector: (s: { user: { roles: string[]; permissions: string[] } | null }) => unknown) =>
      selector({ user: { roles: ['MEDECIN'], permissions: [] } }),
  ),
}));

// ── api client mock — GET list + GET cr-pdf blob ────────────────────────────
const apiGet = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn(),
  },
}));

// ── toast spy ───────────────────────────────────────────────────────────────
const toastInfo = vi.fn();
const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    info: (...a: unknown[]) => toastInfo(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

// ── Other PregnancyTab hooks stubbed (we only exercise the US table) ────────
vi.mock('../hooks/useCurrentPregnancy', () => ({ useCurrentPregnancy: vi.fn() }));
vi.mock('../hooks/usePregnancies', () => ({
  usePregnancies: vi.fn(() => ({ pregnancies: [], isLoading: false, error: null })),
}));
vi.mock('../hooks/usePregnancyVisits', () => ({
  usePregnancyVisits: vi.fn(() => ({ visits: [], isLoading: false, error: null })),
}));
vi.mock('../hooks/usePregnancyAlerts', () => ({
  usePregnancyAlerts: vi.fn(() => ({ alerts: [], isLoading: false, error: null })),
}));
vi.mock('../hooks/usePregnancyPlan', () => ({
  usePregnancyPlan: vi.fn(() => ({ plan: [], isLoading: false, error: null })),
}));

// usePatientDocuments — capture upload calls for the drawer test.
const uploadMock = vi.fn();
vi.mock('@/features/dossier-patient/hooks/usePatientDocuments', () => ({
  usePatientDocuments: vi.fn(() => ({
    upload: uploadMock,
    isUploading: false,
    documents: [],
    isLoading: false,
    error: null,
    remove: vi.fn(),
    isRemoving: false,
    uploadError: null,
  })),
}));

// ── Imports after mocks ─────────────────────────────────────────────────────
import { useCurrentPregnancy } from '../hooks/useCurrentPregnancy';
import { PregnancyTab } from '../components/PregnancyTab';
import { PregnancyUltrasoundDrawer } from '../components/PregnancyUltrasoundDrawer';
import type { Pregnancy } from '../types';

function makePregnancy(overrides: Partial<Pregnancy> = {}): Pregnancy {
  return {
    id: 'preg-1',
    patientId: 'patient-1',
    startedAt: '2026-01-01',
    lmpDate: '2025-12-01',
    dueDate: '2026-09-07',
    dueDateSource: 'NAEGELE',
    status: 'EN_COURS',
    endedAt: null,
    outcome: null,
    childPatientId: null,
    fetuses: [{ label: 'Fœtus unique' }],
    notes: null,
    saWeeks: 22,
    saDays: 3,
    gravidity: 1,
    parity: 0,
    abortions: 0,
    livingChildren: 0,
    version: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderWithQC(ui: ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // window.open + URL.createObjectURL/revokeObjectURL stubs (jsdom lacks them).
  vi.stubGlobal('open', vi.fn());
  Object.defineProperty(URL, 'createObjectURL', {
    value: vi.fn(() => 'blob:cr-pdf'),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: vi.fn(),
    configurable: true,
    writable: true,
  });
});

describe('PregnancyTab — compte-rendu PDF échographie', () => {
  it('downloads the cr-pdf blob when the per-row button is clicked', async () => {
    vi.mocked(useCurrentPregnancy).mockReturnValue({
      pregnancy: makePregnancy(),
      isLoading: false,
      error: null,
    });
    // First api.get → ultrasound list (usePregnancyUltrasounds). Subsequent → blob.
    apiGet.mockImplementation((url: string) => {
      if (url.endsWith('/cr-pdf')) {
        return Promise.resolve({ data: new Blob(['%PDF'], { type: 'application/pdf' }) });
      }
      // ultrasound list
      return Promise.resolve({
        data: [
          {
            id: 'us-1',
            pregnancyId: 'preg-1',
            kind: 'T2_MORPHO',
            performedAt: '2026-03-10',
            saWeeksAtExam: 22,
            saDaysAtExam: 0,
            findings: 'Morphologie normale',
            documentId: null,
            biometryJson: null,
            correctsDueDate: false,
            recordedBy: 'dr',
            version: 0,
          },
        ],
      });
    });

    renderWithQC(<PregnancyTab patientId="patient-1" />);

    const btn = await screen.findByRole('button', {
      name: /Télécharger le compte-rendu PDF/i,
    });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        '/pregnancies/preg-1/ultrasounds/us-1/cr-pdf',
        { responseType: 'blob' },
      );
    });
    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(
        'blob:cr-pdf',
        '_blank',
        'noopener,noreferrer',
      );
    });
  });
});

describe('PregnancyUltrasoundDrawer — upload onFile', () => {
  it('uploads the file and no longer shows the "prochainement" toast', async () => {
    uploadMock.mockResolvedValue({ id: 'doc-99', originalFilename: 'cr.pdf' });

    renderWithQC(
      <PregnancyUltrasoundDrawer
        pregnancy={makePregnancy()}
        open={true}
        onOpenChange={noop}
      />,
    );

    // The DocumentUploadButton renders a hidden file input.
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['%PDF'], 'cr.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(uploadMock).toHaveBeenCalledWith({ file, type: 'IMAGERIE' });
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
    });
    // Critical assertion : the misleading stub toast is gone.
    expect(toastInfo).not.toHaveBeenCalled();
    expect(
      screen.queryByText(/disponible prochainement/i),
    ).not.toBeInTheDocument();
  });
});
