/**
 * Vaccination module — component tests.
 * Hook tests are in hooks.test.ts (separate file to avoid mock collision).
 * Per ADR-018: run only this suite during development:
 *   npm test -- --run features/vaccination
 *
 * Covers:
 *  - DoseCard: status colors + buttons per status x role
 *  - VaccinationCalendarTab: renders sections + cards
 *  - RecordDoseDrawer (record mode): lotNumber validation
 *  - VaccinationCalendarTabMobile: mobile rendering
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// Suppress vaul portal issues in jsdom
vi.mock('vaul', () => ({
  Drawer: {
    Root: ({ children, open }: { children: ReactNode; open?: boolean }) =>
      open ? <div data-testid="vaul-root">{children}</div> : null,
    Portal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Overlay: () => <div />,
    Content: ({
      children,
      'aria-label': label,
    }: {
      children: ReactNode;
      'aria-label'?: string;
    }) => (
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

// ── Mocks for all vaccination hooks ──────────────────────────────────────────

vi.mock('../hooks/useVaccinationCalendar', () => ({
  useVaccinationCalendar: vi.fn(),
}));

vi.mock('../hooks/useVaccinationCatalog', () => ({
  useVaccinationCatalog: vi.fn(() => ({
    catalog: [
      {
        id: 'vax-1',
        code: 'BCG',
        nameFr: 'BCG',
        manufacturerDefault: null,
        routeDefault: 'ID',
        isPni: true,
        active: true,
      },
      {
        id: 'vax-2',
        code: 'PENTA',
        nameFr: 'Pentavalent',
        manufacturerDefault: null,
        routeDefault: 'IM',
        isPni: true,
        active: true,
      },
    ],
    isLoading: false,
    error: null,
  })),
}));

vi.mock('../hooks/useDeferDose', () => ({
  useDeferDose: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

vi.mock('../hooks/useSkipDose', () => ({
  useSkipDose: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

vi.mock('../hooks/useDeleteDose', () => ({
  useDeleteDose: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

vi.mock('../hooks/useDownloadBooklet', () => ({
  useDownloadBooklet: vi.fn(() => ({
    download: vi.fn().mockResolvedValue(undefined),
    isLoading: false,
    error: null,
  })),
}));

vi.mock('../hooks/useRecordDose', () => ({
  useRecordDose: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

vi.mock('../hooks/useUpdateDose', () => ({
  useUpdateDose: vi.fn(() => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  })),
}));

import type { VaccinationCalendarEntry } from '../types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_CALENDAR: VaccinationCalendarEntry[] = [
  {
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
  },
  {
    id: null,
    scheduleDoseId: 'sched-2',
    vaccineId: 'vax-2',
    vaccineCode: 'PENTA',
    vaccineName: 'Pentavalent',
    doseNumber: 1,
    doseLabel: '2 mois D1',
    targetDate: '2024-03-01',
    toleranceDays: 30,
    status: 'OVERDUE',
    administeredAt: null,
    lotNumber: null,
    route: null,
    site: null,
    administeredByName: null,
    deferralReason: null,
    notes: null,
    version: null,
  },
  {
    id: 'dose-3',
    scheduleDoseId: 'sched-3',
    vaccineId: 'vax-3',
    vaccineCode: 'ROR',
    vaccineName: 'ROR',
    doseNumber: 1,
    doseLabel: '12 mois D1',
    targetDate: '2025-01-01',
    toleranceDays: 30,
    status: 'DEFERRED',
    administeredAt: null,
    lotNumber: null,
    route: null,
    site: null,
    administeredByName: null,
    deferralReason: 'Fièvre temporaire',
    notes: null,
    version: 1,
  },
];

// ── Test helpers ─────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithQC(ui: ReactNode) {
  const qc = makeQC();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ── Setup: default calendar mock ─────────────────────────────────────────────

import { useVaccinationCalendar } from '../hooks/useVaccinationCalendar';

beforeEach(() => {
  vi.mocked(useVaccinationCalendar).mockReturnValue({
    calendar: MOCK_CALENDAR,
    isLoading: false,
    error: null,
  });
});

// ── DoseCard ──────────────────────────────────────────────────────────────────

import { DoseCard } from '../components/DoseCard';

describe('DoseCard', () => {
  function renderCard(
    overrides: Partial<VaccinationCalendarEntry> = {},
    canRecord = true,
    canAdmin = true,
  ) {
    const dose: VaccinationCalendarEntry = { ...MOCK_CALENDAR[0]!, ...overrides };
    const onRecord = vi.fn();
    const onDefer = vi.fn();
    const onSkip = vi.fn();
    const onDelete = vi.fn();

    render(
      <DoseCard
        dose={dose}
        canRecord={canRecord}
        canAdmin={canAdmin}
        onRecord={onRecord}
        onDefer={onDefer}
        onSkip={onSkip}
        onDelete={onDelete}
      />,
    );
    return { dose, onRecord, onDefer, onSkip, onDelete };
  }

  it('renders vaccine name and doseLabel', () => {
    renderCard();
    expect(screen.getByText('BCG')).toBeInTheDocument();
    expect(screen.getByText(/Naissance D1/)).toBeInTheDocument();
  });

  it('shows ADMINISTERED status badge', () => {
    renderCard({ status: 'ADMINISTERED' });
    expect(screen.getByText('Administrée')).toBeInTheDocument();
  });

  it('shows OVERDUE status badge', () => {
    renderCard({ status: 'OVERDUE', administeredAt: null });
    expect(screen.getByText('En retard')).toBeInTheDocument();
  });

  it('shows "Saisir dose" button for OVERDUE when canRecord is true', () => {
    renderCard({ status: 'OVERDUE', administeredAt: null, id: null });
    expect(screen.getByRole('button', { name: 'Saisir dose' })).toBeInTheDocument();
  });

  it('does not show "Saisir dose" when canRecord is false', () => {
    renderCard({ status: 'OVERDUE', id: null }, false, false);
    expect(screen.queryByRole('button', { name: 'Saisir dose' })).not.toBeInTheDocument();
  });

  it('shows Modifier and Supprimer for ADMINISTERED when canAdmin is true', () => {
    renderCard({ status: 'ADMINISTERED' });
    expect(screen.getByRole('button', { name: /Modifier/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Supprimer/ })).toBeInTheDocument();
  });

  it('does not show Modifier/Supprimer when canAdmin is false', () => {
    renderCard({ status: 'ADMINISTERED' }, true, false);
    expect(screen.queryByRole('button', { name: /Modifier/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Supprimer/ })).not.toBeInTheDocument();
  });

  it('shows deferral reason for DEFERRED dose', () => {
    renderCard({ status: 'DEFERRED', deferralReason: 'Fièvre temporaire' });
    expect(screen.getByText(/Fièvre temporaire/)).toBeInTheDocument();
  });

  it('calls onRecord with mode "record" when Saisir dose is clicked', () => {
    const { onRecord, dose } = renderCard({
      status: 'OVERDUE',
      administeredAt: null,
      id: null,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Saisir dose' }));
    expect(onRecord).toHaveBeenCalledWith(dose, 'record');
  });

  it('calls onDelete when Supprimer is clicked', () => {
    const { onDelete, dose } = renderCard({ status: 'ADMINISTERED' });
    fireEvent.click(screen.getByRole('button', { name: /Supprimer/ }));
    expect(onDelete).toHaveBeenCalledWith(dose);
  });

  it('has no a11y violations for ADMINISTERED dose', async () => {
    const { container } = render(
      <DoseCard
        dose={{ ...MOCK_CALENDAR[0]! }}
        canRecord={true}
        canAdmin={true}
        onRecord={vi.fn()}
        onDefer={vi.fn()}
        onSkip={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── VaccinationCalendarTab (desktop) ─────────────────────────────────────────

import { VaccinationCalendarTab } from '../components/VaccinationCalendarTab';

describe('VaccinationCalendarTab (desktop)', () => {
  it('renders the Vaccination header and PNI subtitle', () => {
    renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    expect(screen.getByText('Vaccination')).toBeInTheDocument();
    expect(screen.getByText('Carnet PNI marocain')).toBeInTheDocument();
  });

  it('renders the Imprimer carnet button', () => {
    renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    expect(screen.getByRole('button', { name: /Imprimer carnet/ })).toBeInTheDocument();
  });

  it('renders dose cards for BCG, Pentavalent, and ROR', () => {
    renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    expect(screen.getAllByText('BCG').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pentavalent').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ROR').length).toBeGreaterThanOrEqual(1);
  });

  it('renders ADMINISTERED status badge for BCG dose', () => {
    renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    expect(screen.getAllByText('Administrée').length).toBeGreaterThanOrEqual(1);
  });

  it('renders OVERDUE status badge for Pentavalent', () => {
    renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    expect(screen.getAllByText('En retard').length).toBeGreaterThanOrEqual(1);
  });

  it('renders deferral reason text for DEFERRED dose', () => {
    renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    expect(screen.getByText(/Fièvre temporaire/)).toBeInTheDocument();
  });

  it('renders the "Naissance" age group header', () => {
    renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    expect(screen.getByText('Naissance')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithQC(<VaccinationCalendarTab patientId="patient-1" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── VaccinationCalendarTab — empty state ─────────────────────────────────────

describe('VaccinationCalendarTab — empty calendar', () => {
  it('renders the adult empty state message when calendar is empty', () => {
    vi.mocked(useVaccinationCalendar).mockReturnValueOnce({
      calendar: [],
      isLoading: false,
      error: null,
    });

    renderWithQC(<VaccinationCalendarTab patientId="adult-patient" />);
    expect(screen.getByText(/Patient hors plage pédiatrique/)).toBeInTheDocument();
  });
});

// ── RecordDoseDrawer — record mode ────────────────────────────────────────────

import { RecordDoseDrawer } from '../components/RecordDoseDrawer';

describe('RecordDoseDrawer (record mode) — lotNumber validation', () => {
  it('shows validation error when lotNumber is empty on submit', async () => {
    const mockDose: VaccinationCalendarEntry = {
      ...MOCK_CALENDAR[1]!,
      status: 'OVERDUE',
    };

    renderWithQC(
      <RecordDoseDrawer
        patientId="patient-1"
        dose={mockDose}
        mode="record"
        onClose={vi.fn()}
      />,
    );

    const submitBtn = screen.getByRole('button', { name: /Enregistrer la dose/ });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Numéro de lot obligatoire')).toBeInTheDocument();
    });
  });

  it('renders the lotNumber field with required label', () => {
    renderWithQC(
      <RecordDoseDrawer
        patientId="patient-1"
        dose={MOCK_CALENDAR[1]!}
        mode="record"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Numéro de lot *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex. ABC123')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithQC(
      <RecordDoseDrawer
        patientId="patient-1"
        dose={MOCK_CALENDAR[1]!}
        mode="record"
        onClose={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── VaccinationCalendarTabMobile ──────────────────────────────────────────────

import { VaccinationCalendarTabMobile } from '../components/VaccinationCalendarTab.mobile';

describe('VaccinationCalendarTabMobile', () => {
  beforeEach(() => {
    vi.mocked(useVaccinationCalendar).mockReturnValue({
      calendar: MOCK_CALENDAR,
      isLoading: false,
      error: null,
    });
  });

  it('renders Vaccination header', () => {
    renderWithQC(<VaccinationCalendarTabMobile patientId="patient-1" />);
    expect(screen.getByText('Vaccination')).toBeInTheDocument();
  });

  it('renders BCG and Pentavalent dose cards', () => {
    renderWithQC(<VaccinationCalendarTabMobile patientId="patient-1" />);
    expect(screen.getAllByText('BCG').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Pentavalent').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the Imprimer carnet footer button', () => {
    renderWithQC(<VaccinationCalendarTabMobile patientId="patient-1" />);
    expect(screen.getByRole('button', { name: /Imprimer carnet/ })).toBeInTheDocument();
  });

  it('renders deferral reason for DEFERRED dose', () => {
    renderWithQC(<VaccinationCalendarTabMobile patientId="patient-1" />);
    expect(screen.getByText(/Fièvre temporaire/)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithQC(
      <VaccinationCalendarTabMobile patientId="patient-1" />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
