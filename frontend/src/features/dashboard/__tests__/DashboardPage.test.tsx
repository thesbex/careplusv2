/**
 * Tests for DashboardPage (desktop).
 *
 * Run :
 *   cd frontend && npm test -- dashboard --run
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@/components/shell/Screen', () => ({
  Screen: ({ children, title }: { children: ReactNode; title: string }) => (
    <div data-testid="screen">
      <div data-testid="screen-title">{title}</div>
      {children}
    </div>
  ),
}));

const useAuthStoreMock = vi.fn();
vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => useAuthStoreMock(selector),
}));

vi.mock('../hooks/useDashboardClinical', () => ({
  useDashboardClinical: vi.fn(),
}));
vi.mock('../hooks/useDashboardAgenda', () => ({
  useDashboardAgenda: vi.fn(),
}));
vi.mock('../hooks/useDashboardFinancial', () => ({
  useDashboardFinancial: vi.fn(),
}));

// ── Imports after mocks ─────────────────────────────────────────────────────
import DashboardPage from '../DashboardPage';
import { useDashboardClinical } from '../hooks/useDashboardClinical';
import { useDashboardAgenda } from '../hooks/useDashboardAgenda';
import { useDashboardFinancial } from '../hooks/useDashboardFinancial';
import type {
  ClinicalDashboardView,
  AgendaDashboardView,
  FinancialDashboardView,
} from '../types';

// ── Fixtures ────────────────────────────────────────────────────────────────

const CLINICAL: ClinicalDashboardView = {
  patientsActifsTotal: 1240,
  patientsActifs30j: 318,
  consultationsAujourdhui: 14,
  consultationsSemaine: 62,
  consultationsMois: 240,
  ageMoyenPatientele: 38,
  topPathologies: [{ code: 'I10', label: 'HTA', count: 102 }],
  activite7j: [],
  activite30j: [{ date: '2026-04-30', count: 10 }],
};

const AGENDA: AgendaDashboardView = {
  rdvAujourdhui: 18,
  rdvSemaine: 88,
  tauxRemplissageJour: 0.75,
  tauxRemplissageSemaine: 0.6,
  noShowsSemaine: 3,
  annulationsSemaine: 4,
  nouveauxPatientsMois: 22,
  chargeHoraire: [{ slotStart: '08:00', count: 2 }],
};

const FINANCIAL: FinancialDashboardView = {
  caJour: 4500,
  caMois: 102_000,
  caYTD: 410_000,
  caMoisN1: 88_000,
  ca12Mois: [{ month: '2026-04', amount: 95_000 }],
  caParActe: [{ acteCode: 'CONS', label: 'Consultation', amount: 60000, count: 120 }],
  impayesTotal: 12_000,
  impayesCount: 7,
  tauxEncaissement: 0.92,
};

function clinicalOk(data: ClinicalDashboardView | null = CLINICAL, isLoading = false) {
  return {
    data,
    isLoading,
    isFetching: false,
    dataUpdatedAt: data ? Date.now() : 0,
    error: null,
    isEnabled: true,
  };
}

function agendaOk(data: AgendaDashboardView | null = AGENDA, isLoading = false) {
  return {
    data,
    isLoading,
    isFetching: false,
    dataUpdatedAt: data ? Date.now() : 0,
    error: null,
    isEnabled: true,
  };
}

function financialOk(
  data: FinancialDashboardView | null = FINANCIAL,
  isLoading = false,
  isEnabled = true,
) {
  return {
    data,
    isLoading,
    isFetching: false,
    dataUpdatedAt: data ? Date.now() : 0,
    error: null,
    isEnabled,
  };
}

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderPage() {
  const qc = makeQC();
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <QueryClientProvider client={qc}>
        <DashboardPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('DashboardPage — desktop', () => {
  beforeEach(() => {
    useAuthStoreMock.mockReset();
    vi.mocked(useDashboardClinical).mockReset();
    vi.mocked(useDashboardAgenda).mockReset();
    vi.mocked(useDashboardFinancial).mockReset();
  });

  it('renders all sections (clinical + agenda + financial) for MEDECIN', () => {
    useAuthStoreMock.mockImplementation(
      (selector: (s: { user: { roles: string[] } }) => unknown) =>
        selector({ user: { roles: ['MEDECIN'] } }),
    );
    vi.mocked(useDashboardClinical).mockReturnValue(clinicalOk());
    vi.mocked(useDashboardAgenda).mockReturnValue(agendaOk());
    vi.mocked(useDashboardFinancial).mockReturnValue(financialOk());

    renderPage();

    expect(screen.getByTestId('screen-title')).toHaveTextContent('Dashboard');
    // Today section + cards visible
    expect(screen.getByTestId('dash-section-today')).toBeInTheDocument();
    // jsdom's ICU might use space, period or comma as the FR thousands
    // separator depending on the host — assert on the digits only.
    expect(screen.getByTestId('kpi-patients-actifs').textContent).toMatch(/1[ .,]?240/);
    expect(screen.getByTestId('kpi-rdv-jour').textContent).toMatch(/18/);
    // Financial section IS visible
    expect(screen.getByTestId('dash-section-financial')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-ca-jour')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-ca-mois')).toBeInTheDocument();
  });

  it('hides the financial section for SECRETAIRE', () => {
    useAuthStoreMock.mockImplementation(
      (selector: (s: { user: { roles: string[] } }) => unknown) =>
        selector({ user: { roles: ['SECRETAIRE'] } }),
    );
    // Pour SECRETAIRE, useDashboardClinical/Financial sont auto-désactivés
    // via leur logique interne, mais le test ici contrôle le rendu : on
    // simule simplement que financial n'a pas de data.
    vi.mocked(useDashboardClinical).mockReturnValue(clinicalOk(null));
    vi.mocked(useDashboardAgenda).mockReturnValue(agendaOk());
    vi.mocked(useDashboardFinancial).mockReturnValue(financialOk(null, false, false));

    renderPage();

    expect(screen.getByTestId('dash-section-today')).toBeInTheDocument();
    // Financial section must NOT render
    expect(screen.queryByTestId('dash-section-financial')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-ca-jour')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kpi-ca-mois')).not.toBeInTheDocument();
    // Agenda section reste affichée
    expect(screen.getByTestId('dash-section-agenda')).toBeInTheDocument();
  });

  it('shows loading skeletons before the hooks resolve', () => {
    useAuthStoreMock.mockImplementation(
      (selector: (s: { user: { roles: string[] } }) => unknown) =>
        selector({ user: { roles: ['MEDECIN'] } }),
    );
    vi.mocked(useDashboardClinical).mockReturnValue(clinicalOk(null, true));
    vi.mocked(useDashboardAgenda).mockReturnValue(agendaOk(null, true));
    vi.mocked(useDashboardFinancial).mockReturnValue(financialOk(null, true));

    renderPage();

    // Card title remains visible even during loading
    expect(screen.getByTestId('kpi-patients-actifs')).toHaveTextContent(
      /Patients actifs/i,
    );
    // Last-update tag should NOT render when no hook has data yet
    expect(screen.queryByTestId('dash-last-update')).not.toBeInTheDocument();
  });
});
