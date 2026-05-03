/**
 * Étape 5 — Vaccination worklist + Paramétrage tab.
 * Smoke tests: rendering, tab switches, badge count, upsert/delete hooks.
 *
 * Run: npm test -- --run features/vaccination/etape5
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Suppress noisy logs from jsdom ────────────────────────────────────────────
// Keep console.error for a11y violations; suppress only the known portal warning.
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

vi.mock('vaul', () => ({
  Drawer: {
    Root: ({ children, open }: { children: ReactNode; open?: boolean }) =>
      open ? <div data-testid="vaul-root">{children}</div> : null,
    Portal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Overlay: () => <div />,
    Content: ({ children, 'aria-label': label }: { children: ReactNode; 'aria-label'?: string }) => (
      <div role="dialog" aria-label={label ?? 'drawer'}>
        {children}
      </div>
    ),
    Trigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));

vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(
    (selector: (s: { user: { roles: string[]; permissions: string[] } | null }) => unknown) =>
      selector({ user: { roles: ['MEDECIN'], permissions: [] } }),
  ),
}));

// ── Mock shell components so we don't need full app context ───────────────────

vi.mock('@/components/shell/Screen', () => ({
  Screen: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: string;
    active?: string;
    sub?: string;
    onNavigate?: unknown;
    topbarRight?: unknown;
  }) => (
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
  MTopbar: ({ title }: { title?: string }) => <div data-testid="mtopbar">{title}</div>,
}));

// ── Mock hooks ────────────────────────────────────────────────────────────────

interface MockQueueData {
  entries: Array<{
    patientId: string;
    patientFirstName: string;
    patientLastName: string;
    patientPhotoDocumentId: string | null;
    patientBirthDate: string;
    vaccineId: string;
    vaccineCode: string;
    vaccineName: string;
    doseNumber: number;
    doseLabel: string;
    scheduleDoseId: string | null;
    targetDate: string;
    daysOverdue: number;
    status: 'OVERDUE' | 'DUE_SOON' | 'UPCOMING';
  }>;
  totalElements: number;
  totalPages: number;
  currentPage: number;
  page: unknown;
  isLoading: boolean;
  error: string | null;
}

const mockQueueData: MockQueueData = {
  entries: [
    {
      patientId: 'pat-1',
      patientFirstName: 'Amir',
      patientLastName: 'Benali',
      patientPhotoDocumentId: null,
      patientBirthDate: '2023-01-15',
      vaccineId: 'vax-1',
      vaccineCode: 'BCG',
      vaccineName: 'BCG',
      doseNumber: 1,
      doseLabel: 'Naissance D1',
      scheduleDoseId: 'sched-1',
      targetDate: '2023-01-15',
      daysOverdue: 45,
      status: 'OVERDUE',
    },
    {
      patientId: 'pat-2',
      patientFirstName: 'Sara',
      patientLastName: 'Alami',
      patientPhotoDocumentId: null,
      patientBirthDate: '2023-06-01',
      vaccineId: 'vax-2',
      vaccineCode: 'PENTA',
      vaccineName: 'Pentavalent',
      doseNumber: 1,
      doseLabel: '2 mois D1',
      scheduleDoseId: 'sched-2',
      targetDate: '2023-08-01',
      daysOverdue: 12,
      status: 'OVERDUE',
    },
  ],
  totalElements: 2,
  totalPages: 1,
  currentPage: 0,
  page: null,
  isLoading: false,
  error: null,
};

const mockCatalog = [
  { id: 'vax-1', code: 'BCG', nameFr: 'BCG', manufacturerDefault: null, routeDefault: 'ID' as const, isPni: true, active: true },
  { id: 'vax-2', code: 'PENTA', nameFr: 'Pentavalent', manufacturerDefault: null, routeDefault: 'IM' as const, isPni: true, active: true },
];

const mockSchedule = [
  { id: 'sched-1', vaccineId: 'vax-1', vaccineCode: 'BCG', vaccineNameFr: 'BCG', doseNumber: 1, targetAgeDays: 0, toleranceDays: 30, labelFr: 'BCG Naissance D1' },
  { id: 'sched-2', vaccineId: 'vax-2', vaccineCode: 'PENTA', vaccineNameFr: 'Pentavalent', doseNumber: 1, targetAgeDays: 60, toleranceDays: 30, labelFr: 'Penta 2 mois D1' },
];

// Mocks typed with function-signature generic to satisfy TS strict mode.
const useVaccinationsQueueMock = vi.fn<(filters?: unknown) => MockQueueData>(() => mockQueueData);
const useVaccinationCatalogMock = vi.fn(() => ({ catalog: mockCatalog, isLoading: false, error: null as string | null }));
const useVaccinationScheduleMock = vi.fn(() => ({ schedule: mockSchedule, isLoading: false, error: null as string | null }));
const useUpsertVaccineMock = vi.fn<(mode?: string) => { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean }>(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }));
const useDeactivateVaccineMock = vi.fn(() => ({ deactivate: vi.fn().mockResolvedValue({}), isPending: false }));
const useUpsertScheduleDoseMock = vi.fn<(mode?: string) => { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean }>(() => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }));
const useDeleteScheduleDoseMock = vi.fn(() => ({ deleteDose: vi.fn().mockResolvedValue({}), isPending: false, deletingId: undefined as string | undefined }));
const useVaccinationOverdueCountMock = vi.fn(() => 3);

vi.mock('../hooks/useVaccinationsQueue', () => ({
  useVaccinationsQueue: (filters: unknown) => useVaccinationsQueueMock(filters),
}));

vi.mock('../hooks/useVaccinationCatalog', () => ({
  useVaccinationCatalog: () => useVaccinationCatalogMock(),
}));

vi.mock('../hooks/useVaccinationSchedule', () => ({
  useVaccinationSchedule: () => useVaccinationScheduleMock(),
}));

vi.mock('../hooks/useUpsertVaccine', () => ({
  useUpsertVaccine: (mode: string) => useUpsertVaccineMock(mode),
}));

vi.mock('../hooks/useDeactivateVaccine', () => ({
  useDeactivateVaccine: () => useDeactivateVaccineMock(),
}));

vi.mock('../hooks/useUpsertScheduleDose', () => ({
  useUpsertScheduleDose: (mode: string) => useUpsertScheduleDoseMock(mode),
}));

vi.mock('../hooks/useDeleteScheduleDose', () => ({
  useDeleteScheduleDose: () => useDeleteScheduleDoseMock(),
}));

vi.mock('@/features/vaccination/hooks/useVaccinationOverdueCount', () => ({
  useVaccinationOverdueCount: () => useVaccinationOverdueCountMock(),
}));

vi.mock('../components/RecordDoseDrawer', () => ({
  RecordDoseDrawer: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="record-dose-drawer">
      <button type="button" onClick={onClose}>Fermer</button>
    </div>
  ),
}));

vi.mock('../components/RecordDoseDrawer.mobile', () => ({
  RecordDoseDrawerMobile: () => <div data-testid="record-dose-drawer-mobile" />,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithAll(ui: ReactNode) {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/vaccinations']}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── VaccinationsQueuePage (desktop) ───────────────────────────────────────────

import VaccinationsQueuePage from '../VaccinationsQueuePage';

describe('VaccinationsQueuePage (desktop)', () => {
  it('renders the page title and subtitle', () => {
    renderWithAll(<VaccinationsQueuePage />);
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Vaccinations');
  });

  it('renders the 3 tabs (En retard / Dues cette semaine / Dues ce mois)', () => {
    renderWithAll(<VaccinationsQueuePage />);
    expect(screen.getByRole('tab', { name: /En retard/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Dues cette semaine/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Dues ce mois/ })).toBeInTheDocument();
  });

  it('renders patient names from mock data', () => {
    renderWithAll(<VaccinationsQueuePage />);
    expect(screen.getByText(/Benali/)).toBeInTheDocument();
    expect(screen.getByText(/Alami/)).toBeInTheDocument();
  });

  it('renders vaccine names from mock data', () => {
    renderWithAll(<VaccinationsQueuePage />);
    expect(screen.getAllByText('BCG').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pentavalent').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Saisir dose" buttons for each entry', () => {
    renderWithAll(<VaccinationsQueuePage />);
    const buttons = screen.getAllByRole('button', { name: 'Saisir dose' });
    expect(buttons.length).toBe(2);
  });

  it('clicking "Saisir dose" opens the drawer', () => {
    renderWithAll(<VaccinationsQueuePage />);
    const btn = screen.getAllByRole('button', { name: 'Saisir dose' })[0]!;
    fireEvent.click(btn);
    expect(screen.getByTestId('record-dose-drawer')).toBeInTheDocument();
  });

  it('switches to DUE_SOON tab and calls hook with correct status', () => {
    renderWithAll(<VaccinationsQueuePage />);
    fireEvent.click(screen.getByRole('tab', { name: /Dues cette semaine/ }));
    // The hook should have been called with DUE_SOON status
    const calls = useVaccinationsQueueMock.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ status: 'DUE_SOON' });
  });

  it('switches to UPCOMING tab and calls hook with upcomingHorizonDays=30', () => {
    renderWithAll(<VaccinationsQueuePage />);
    fireEvent.click(screen.getByRole('tab', { name: /Dues ce mois/ }));
    const calls = useVaccinationsQueueMock.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall?.[0]).toMatchObject({ status: 'UPCOMING', upcomingHorizonDays: 30 });
  });

  it('renders overdue badge count in the En retard tab', () => {
    renderWithAll(<VaccinationsQueuePage />);
    // The badge count (totalElements=2) should appear on the active OVERDUE tab
    const tab = screen.getByRole('tab', { name: /En retard/ });
    expect(tab.textContent).toMatch(/2/);
  });

  it('renders empty state text when no entries', () => {
    useVaccinationsQueueMock.mockReturnValueOnce({
      ...mockQueueData,
      entries: [],
      totalElements: 0,
    });
    renderWithAll(<VaccinationsQueuePage />);
    expect(screen.getByText('Aucune dose en retard')).toBeInTheDocument();
  });

  it('renders error state when API fails', () => {
    useVaccinationsQueueMock.mockReturnValueOnce({
      ...mockQueueData,
      entries: [],
      error: 'Impossible de charger la liste des vaccinations.',
    });
    renderWithAll(<VaccinationsQueuePage />);
    expect(screen.getByText(/Impossible de charger/)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithAll(<VaccinationsQueuePage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── VaccinationsQueuePage (mobile) ────────────────────────────────────────────

import VaccinationsQueuePageMobile from '../VaccinationsQueuePage.mobile';

describe('VaccinationsQueuePage (mobile)', () => {
  it('renders the topbar with correct title', () => {
    renderWithAll(<VaccinationsQueuePageMobile />);
    expect(screen.getByTestId('mtopbar')).toHaveTextContent('Vaccinations');
  });

  it('renders vaccination cards for each entry', () => {
    renderWithAll(<VaccinationsQueuePageMobile />);
    expect(screen.getByText(/Benali/)).toBeInTheDocument();
    expect(screen.getByText(/Alami/)).toBeInTheDocument();
  });

  it('renders Saisir buttons', () => {
    renderWithAll(<VaccinationsQueuePageMobile />);
    const buttons = screen.getAllByRole('button', { name: 'Saisir' });
    expect(buttons.length).toBe(2);
  });

  it('renders the 3 sticky tabs', () => {
    renderWithAll(<VaccinationsQueuePageMobile />);
    expect(screen.getByRole('tab', { name: /En retard/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Cette semaine/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Ce mois/ })).toBeInTheDocument();
  });

  it('shows empty state on empty list', () => {
    useVaccinationsQueueMock.mockReturnValueOnce({
      ...mockQueueData,
      entries: [],
      totalElements: 0,
    });
    renderWithAll(<VaccinationsQueuePageMobile />);
    expect(screen.getByText('Aucune dose en retard')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithAll(<VaccinationsQueuePageMobile />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Sidebar badge count ───────────────────────────────────────────────────────

import { Sidebar } from '@/components/shell/Sidebar';

// We need a real provider for Sidebar since it calls useVaccinationOverdueCount
function renderSidebar(props = {}) {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <Sidebar active="vaccinations" {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Sidebar vaccination badge', () => {
  it('renders the Vaccinations nav item', () => {
    renderSidebar();
    expect(screen.getByText('Vaccinations')).toBeInTheDocument();
  });

  it('renders badge with overdue count when > 0', () => {
    useVaccinationOverdueCountMock.mockReturnValue(3);
    renderSidebar();
    // Badge should show "3"
    expect(screen.getByLabelText(/3 en attente/i)).toBeInTheDocument();
  });

  it('does not render badge when overdue count is 0', () => {
    useVaccinationOverdueCountMock.mockReturnValue(0);
    renderSidebar();
    // No badge with aria-label pattern
    expect(screen.queryByLabelText(/en attente/i)).not.toBeInTheDocument();
  });
});

// ── VaccinationParamTab ───────────────────────────────────────────────────────

import { VaccinationParamTab } from '../components/VaccinationParamTab';

function renderParamTab() {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <VaccinationParamTab />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('VaccinationParamTab', () => {
  it('renders Vaccins section title', () => {
    renderParamTab();
    expect(screen.getByText('Vaccins')).toBeInTheDocument();
  });

  it('renders Calendrier vaccinal section title', () => {
    renderParamTab();
    expect(screen.getByText('Calendrier vaccinal')).toBeInTheDocument();
  });

  it('renders vaccine catalog entries', () => {
    renderParamTab();
    expect(screen.getAllByText('BCG').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pentavalent').length).toBeGreaterThanOrEqual(1);
  });

  it('renders schedule dose entries', () => {
    renderParamTab();
    expect(screen.getByText('BCG Naissance D1')).toBeInTheDocument();
    expect(screen.getByText('Penta 2 mois D1')).toBeInTheDocument();
  });

  it('renders "Ajouter un vaccin" button', () => {
    renderParamTab();
    expect(screen.getByRole('button', { name: /Ajouter un vaccin/ })).toBeInTheDocument();
  });

  it('renders "Ajouter une dose" button', () => {
    renderParamTab();
    expect(screen.getByRole('button', { name: /Ajouter une dose/ })).toBeInTheDocument();
  });

  it('opens vaccine form drawer when "Ajouter un vaccin" is clicked', () => {
    renderParamTab();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un vaccin/ }));
    // The drawer renders a heading with this text (there will be multiple now: button + heading)
    const matches = screen.getAllByText('Ajouter un vaccin');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('shows vaccine form with code, name inputs', () => {
    renderParamTab();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un vaccin/ }));
    expect(screen.getByLabelText(/Code/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom/)).toBeInTheDocument();
  });

  it('clicking Modifier on a vaccine opens edit drawer', () => {
    renderParamTab();
    const editButtons = screen.getAllByRole('button', { name: /Modifier/ });
    // Filter for catalog section (there are also Modifier buttons in schedule section)
    fireEvent.click(editButtons[0]!);
    expect(screen.getByText(/Modifier le vaccin/)).toBeInTheDocument();
  });

  it('shows PNI protection: no Désactiver button for PNI vaccines', () => {
    // The UI hides the Trash button for PNI vaccines
    renderParamTab();
    // BCG is PNI, so its row should NOT have a Trash/Désactiver button
    // The deactivate buttons only appear for non-PNI vaccines
    const trashButtons = screen.queryAllByRole('button', { name: /Désactiver/ });
    // Both BCG and PENTA are PNI, so there should be no trash buttons
    expect(trashButtons.length).toBe(0);
  });

  it('calls useUpsertVaccine with create mode when saving new vaccine', async () => {
    const mutateFn = vi.fn().mockResolvedValue({});
    // Use mockReturnValue (persistent) so every render of VaccineFormDrawer gets the same mock
    useUpsertVaccineMock.mockReturnValue({ mutateAsync: mutateFn, isPending: false });

    renderParamTab();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un vaccin/ }));

    const codeInput = screen.getByLabelText(/Code/);
    const nameInput = screen.getByLabelText(/Nom/);
    fireEvent.change(codeInput, { target: { value: 'MENI' } });
    fireEvent.change(nameInput, { target: { value: 'Méningococcique' } });

    fireEvent.click(screen.getByRole('button', { name: /^Ajouter$/ }));

    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(mutateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          body: expect.objectContaining({ nameFr: 'Méningococcique' }),
        }),
      );
    });

    // Restore default mock so other tests are unaffected
    useUpsertVaccineMock.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false });
  });

  it('opens schedule dose form when "Ajouter une dose" is clicked', () => {
    renderParamTab();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une dose/ }));
    expect(screen.getByText(/Ajouter une dose au calendrier/)).toBeInTheDocument();
  });

  it('shows delete confirm dialog when clicking Supprimer on a schedule dose', () => {
    renderParamTab();
    const deleteButtons = screen.getAllByRole('button', { name: /Supprimer/ });
    fireEvent.click(deleteButtons[0]!);
    expect(screen.getByText(/Supprimer cette ligne du calendrier/)).toBeInTheDocument();
  });

  it('calls deleteScheduleDose when delete is confirmed', async () => {
    const deleteFn = vi.fn().mockResolvedValue({});
    // Use mockReturnValue (persistent) so every re-render of VaccineScheduleSection gets the same fn
    useDeleteScheduleDoseMock.mockReturnValue({
      deleteDose: deleteFn,
      isPending: false,
      deletingId: undefined,
    });

    renderParamTab();
    const deleteButtons = screen.getAllByRole('button', { name: /Supprimer/ });
    fireEvent.click(deleteButtons[0]!);

    const confirmBtn = screen.getByRole('button', { name: /^Supprimer$/ });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalledWith('sched-1');
    });

    // Restore default mock
    useDeleteScheduleDoseMock.mockReturnValue({ deleteDose: vi.fn().mockResolvedValue({}), isPending: false, deletingId: undefined });
  });

  it('has no a11y violations', async () => {
    const { container } = renderParamTab();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── useVaccinationOverdueCount (badge) ────────────────────────────────────────

describe('useVaccinationOverdueCount — badge count renders correctly', () => {
  it('returns the mock overdue count', () => {
    useVaccinationOverdueCountMock.mockReturnValue(5);
    // Verify by rendering the sidebar and checking badge
    const qc = makeQC();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Sidebar active="agenda" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const badge = container.querySelector('.cp-nav-badge');
    // badge appears for the vaccinations item
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe('5');
  });
});
