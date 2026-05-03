/**
 * Étape 5 — Grossesse worklist + sidebar badge + BioPanelButton standalone.
 *
 * Run only this slice :
 *   cd frontend && npx vitest run features/grossesse
 *
 * Covers :
 *  - PregnancesQueuePage : empty state, render rows + alerts, trimester chip
 *    sets URL param, withAlerts checkbox sets URL param, debounced search,
 *    "Voir" navigates to /patients/{id}?tab=grossesse.
 *  - useGrossesseAlertsCount : refetchInterval = 30 s.
 *  - BioPanelButton : standalone path opens BioPanelPreviewDialog with the
 *    fetched lines (Option D — no consultationId required).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type * as ReactRouterDom from 'react-router-dom';

// ── Suppress noisy logs from jsdom ────────────────────────────────────────────
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') || args[0].includes('act('))
    )
      return;
    originalError(...args);
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

// Auth — default MEDECIN
vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(
    (selector: (s: { user: { roles: string[]; permissions: string[] } | null }) => unknown) =>
      selector({ user: { roles: ['MEDECIN'], permissions: [] } }),
  ),
}));

// Stub shells so we don't need the full app context.
vi.mock('@/components/shell/Screen', () => ({
  Screen: ({ children, title }: { children: ReactNode; title: string }) => (
    <div data-testid="screen">
      <div data-testid="screen-title">{title}</div>
      {children}
    </div>
  ),
}));

vi.mock('@/components/shell/MScreen', () => ({
  MScreen: ({ children, topbar }: { children: ReactNode; topbar?: ReactNode }) => (
    <div data-testid="mscreen">
      {topbar}
      {children}
    </div>
  ),
}));

vi.mock('@/components/shell/MTopbar', () => ({
  MTopbar: ({ title, right }: { title?: string; right?: ReactNode }) => (
    <div data-testid="mtopbar">
      {title}
      {right}
    </div>
  ),
}));

// Mock the queue hook so we can drive entries / filters from the test.
vi.mock('../hooks/usePregnancyQueue', () => ({
  usePregnancyQueue: vi.fn(),
}));

vi.mock('../hooks/useBioPanelTemplate', () => ({
  useBioPanelTemplate: vi.fn(),
}));

// ── Imports after mocks ────────────────────────────────────────────────────
import { usePregnancyQueue } from '../hooks/usePregnancyQueue';
import { useBioPanelTemplate } from '../hooks/useBioPanelTemplate';
import PregnancesQueuePage from '../PregnancesQueuePage';
import { BioPanelButton } from '../components/BioPanelButton';
import { useGrossesseAlertsCount } from '../hooks/useGrossesseAlertsCount';
import type { PregnancyQueueEntry } from '../hooks/usePregnancyQueue';

// react-router-dom — keep real implementation but spy on useNavigate.
const navigateSpy = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof ReactRouterDom>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

// ── Fixtures ───────────────────────────────────────────────────────────────
function makeEntry(overrides: Partial<PregnancyQueueEntry> = {}): PregnancyQueueEntry {
  return {
    pregnancyId: 'preg-1',
    patientId: 'patient-1',
    patientFirstName: 'Salma',
    patientLastName: 'Bennani',
    patientPhotoDocumentId: null,
    saWeeks: 22,
    saDays: 3,
    trimester: 'T2',
    dueDate: '2026-09-07',
    lastVisitAt: '2026-04-12T09:00:00Z',
    alerts: [],
    ...overrides,
  };
}

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithQC(ui: ReactNode, initialEntries: string[] = ['/grossesses']) {
  const qc = makeQC();
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
    </MemoryRouter>,
  );
}

const queueOk = (entries: PregnancyQueueEntry[], total = entries.length) => ({
  page: null,
  entries,
  totalElements: total,
  totalPages: Math.max(1, Math.ceil(total / 20)),
  currentPage: 0,
  isLoading: false,
  error: null,
});

// ── Tests ──────────────────────────────────────────────────────────────────

describe('PregnancesQueuePage — desktop', () => {
  beforeEach(() => {
    navigateSpy.mockReset();
    vi.mocked(usePregnancyQueue).mockReturnValue(queueOk([]));
  });

  it('renders empty state when queue is empty', () => {
    vi.mocked(usePregnancyQueue).mockReturnValue(queueOk([]));
    renderWithQC(<PregnancesQueuePage />);
    expect(screen.getByText(/Aucune grossesse en cours/i)).toBeInTheDocument();
  });

  it('renders rows with SA + alerts badges', () => {
    vi.mocked(usePregnancyQueue).mockReturnValue(
      queueOk([
        makeEntry({
          pregnancyId: 'preg-a',
          patientId: 'pa',
          patientFirstName: 'Salma',
          patientLastName: 'Bennani',
          saWeeks: 22,
          saDays: 3,
          alerts: [
            { code: 'HTA_GRAVIDIQUE', label: 'HTA gravidique', severity: 'WARNING', since: '2026-04-12' },
          ],
        }),
        makeEntry({
          pregnancyId: 'preg-b',
          patientId: 'pb',
          patientFirstName: 'Imane',
          patientLastName: 'Alami',
          saWeeks: 36,
          saDays: 0,
          trimester: 'T3',
          alerts: [],
        }),
      ]),
    );
    renderWithQC(<PregnancesQueuePage />);
    expect(screen.getByTestId('pq-row-preg-a')).toBeInTheDocument();
    expect(screen.getByTestId('pq-row-preg-b')).toBeInTheDocument();
    expect(screen.getByTestId('pq-alert-HTA_GRAVIDIQUE')).toBeInTheDocument();
    // 2 grossesses
    expect(screen.getByText(/2 grossesses/i)).toBeInTheDocument();
  });

  it('clicking trimester chip calls usePregnancyQueue with that filter', () => {
    vi.mocked(usePregnancyQueue).mockReturnValue(queueOk([]));
    renderWithQC(<PregnancesQueuePage />);
    const t2 = screen.getByRole('tab', { name: 'T2' });
    fireEvent.click(t2);
    // Last call : filters.trimester === 'T2'
    const calls = vi.mocked(usePregnancyQueue).mock.calls;
    const lastFilters = calls[calls.length - 1]?.[0];
    expect(lastFilters?.trimester).toBe('T2');
  });

  it('toggling withAlerts checkbox propagates the filter', () => {
    vi.mocked(usePregnancyQueue).mockReturnValue(queueOk([]));
    renderWithQC(<PregnancesQueuePage />);
    const checkbox = screen.getByLabelText(/Avec alertes uniquement/i);
    fireEvent.click(checkbox);
    const calls = vi.mocked(usePregnancyQueue).mock.calls;
    const lastFilters = calls[calls.length - 1]?.[0];
    expect(lastFilters?.withAlerts).toBe(true);
  });

  it('search input is debounced (200 ms) before propagating to query', () => {
    vi.useFakeTimers();
    vi.mocked(usePregnancyQueue).mockReturnValue(queueOk([]));
    renderWithQC(<PregnancesQueuePage />);
    const input = screen.getByLabelText(/Rechercher une patiente/i);
    fireEvent.change(input, { target: { value: 'Ben' } });

    // Before 200 ms the q filter is still empty.
    let calls = vi.mocked(usePregnancyQueue).mock.calls;
    let lastFilters = calls[calls.length - 1]?.[0];
    expect(lastFilters?.q).toBeUndefined();

    // Advance the debounce timer.
    act(() => {
      vi.advanceTimersByTime(220);
    });

    calls = vi.mocked(usePregnancyQueue).mock.calls;
    lastFilters = calls[calls.length - 1]?.[0];
    expect(lastFilters?.q).toBe('Ben');
    vi.useRealTimers();
  });

  it('clicking "Voir" navigates to /patients/{id}?tab=grossesse', () => {
    vi.mocked(usePregnancyQueue).mockReturnValue(
      queueOk([
        makeEntry({ pregnancyId: 'preg-1', patientId: 'patient-42' }),
      ]),
    );
    renderWithQC(<PregnancesQueuePage />);
    const voir = screen.getByRole('button', { name: /^Voir$/ });
    fireEvent.click(voir);
    expect(navigateSpy).toHaveBeenCalledWith('/patients/patient-42?tab=grossesse');
  });
});

describe('useGrossesseAlertsCount', () => {
  it('hook factory configures refetchInterval 30 s', async () => {
    // Static check on the compiled hook source. Vite SSR transform may rewrite
    // the numeric literal as `30_000` or `3e4` ; both encode 30 seconds.
    const mod = await import('../hooks/useGrossesseAlertsCount');
    const src = mod.useGrossesseAlertsCount.toString();
    expect(src).toContain('refetchInterval');
    expect(/30_?000|3e4/.test(src)).toBe(true);
  });

  it('returns undefined when called outside a QueryClientProvider (fallback path)', () => {
    // Render the hook in a host component without QueryClientProvider — the
    // hook must fall back to the disabled local client and return undefined
    // without throwing.
    function Host() {
      const v = useGrossesseAlertsCount();
      return <div data-testid="badge-count">{v ?? 'none'}</div>;
    }
    render(<Host />);
    expect(screen.getByTestId('badge-count')).toHaveTextContent('none');
  });
});

describe('BioPanelButton — standalone (Option D)', () => {
  beforeEach(() => {
    vi.mocked(useBioPanelTemplate).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        id: 't1',
        name: 'Bilan T2',
        type: 'LAB' as const,
        lines: [
          { labTestId: 'lab-1', labTestCode: 'NFS' },
          { labTestId: 'lab-2', labTestCode: 'HGPO75' },
        ],
        lineCount: 2,
        updatedAt: '2026-05-03T00:00:00Z',
      }),
      isPending: false,
    } as unknown as ReturnType<typeof useBioPanelTemplate>);
  });

  it('opens BioPanelPreviewDialog with the loaded lines when no callback is provided', async () => {
    renderWithQC(<BioPanelButton pregnancyId="preg-1" trimester="T2" />);
    fireEvent.click(screen.getByRole('button', { name: /Prescrire bilan T2/i }));
    await waitFor(() => {
      expect(screen.getByTestId('bio-panel-preview')).toBeInTheDocument();
      const lines = screen.getByTestId('bio-panel-lines');
      expect(lines).toHaveTextContent('NFS');
      expect(lines).toHaveTextContent('HGPO75');
    });
  });

  it('calls onTemplateLoaded and does NOT show the preview dialog when consultation-context callback is provided', async () => {
    const onTemplateLoaded = vi.fn();
    renderWithQC(
      <BioPanelButton
        pregnancyId="preg-1"
        trimester="T2"
        onTemplateLoaded={onTemplateLoaded}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Prescrire bilan T2/i }));
    await waitFor(() => {
      expect(onTemplateLoaded).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId('bio-panel-preview')).not.toBeInTheDocument();
  });
});
