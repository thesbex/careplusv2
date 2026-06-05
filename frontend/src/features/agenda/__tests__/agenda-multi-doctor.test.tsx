/**
 * Wave 1 (2026-05-07) — auto-adaptive practitioner dropdown on AgendaPage.
 *
 * Drives the desktop AgendaPage with mocked practitioner / appointment hooks
 * and asserts that:
 *  - 0 or 1 active practitioner → no dropdown rendered (single-doctor mode).
 *  - ≥ 2 practitioners → dropdown rendered with "Tous" + each option.
 *  - Default is "Tous" for SECRETAIRE/ADMIN, "self" for MEDECIN.
 *  - Switching dropdown updates the practitionerIdFilter passed to
 *    useWeekAppointments.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth/authStore';

// ── Stable mocks for the dependency tree ──────────────────────────────────

const useWeekAppointmentsMock = vi.fn();
vi.mock('../hooks/useAppointments', () => ({
  useWeekAppointments: (
    weekOffset: number,
    options?: { practitionerIdFilter?: string },
  ) => useWeekAppointmentsMock(weekOffset, options),
  useMonthAppointments: () => ({ appointments: [], isLoading: false }),
  ALL_PRACTITIONERS: 'ALL',
}));

const usePractitionersMock = vi.fn();
vi.mock('../hooks/usePractitioners', () => ({
  usePractitioners: () => usePractitionersMock(),
}));

vi.mock('../hooks/useRooms', () => ({
  useRooms: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('@/features/parametres/hooks/useLeaves', () => ({
  useLeaves: () => ({ leaves: [], isLoading: false, error: null }),
}));

// ── Imports after mocks ───────────────────────────────────────────────────
import AgendaPage from '../AgendaPage';
import { WEEK_DAYS } from '../fixtures';

const MED_A = {
  id: 'med-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  firstName: 'Karim',
  lastName: 'Bennani',
  specialty: 'Pédiatre',
  active: true,
};
const MED_B = {
  id: 'med-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  firstName: 'Sara',
  lastName: 'Idrissi',
  specialty: null,
  active: true,
};

const baseAppointmentsResult = {
  days: WEEK_DAYS,
  appointments: [],
  rawAppointments: [],
  arrivals: [],
  weekLabel: '21 – 26 avr. 2026',
  todayKey: 'jeu' as const,
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/agenda', element: <AgendaPage /> },
      { path: '/salle', element: <div>Salle</div> },
      { path: '/patients', element: <div>Patients</div> },
    ],
    { initialEntries: ['/agenda'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useWeekAppointmentsMock.mockReset();
  useWeekAppointmentsMock.mockReturnValue(baseAppointmentsResult);
  usePractitionersMock.mockReset();
  // Reset auth + localStorage for each test.
  useAuthStore.setState({ accessToken: null, user: null });
  try {
    localStorage.removeItem('agenda.practitionerFilter');
  } catch {
    // ignore
  }
});

afterEach(() => {
  try {
    localStorage.removeItem('agenda.practitionerFilter');
  } catch {
    // ignore
  }
});

describe('AgendaPage — auto-adaptive practitioner dropdown (Wave 1)', () => {
  it('renders no practitioner dropdown when 0 practitioners returned', () => {
    usePractitionersMock.mockReturnValue({ data: [], isLoading: false, isError: false });
    useAuthStore.setState({
      accessToken: 't',
      user: { id: 'u1', email: 'me@x', firstName: 'M', lastName: 'D', roles: ['MEDECIN'] },
    });

    renderPage();

    expect(screen.queryByLabelText('Filtrer par médecin')).not.toBeInTheDocument();
  });

  it('renders no practitioner dropdown when only 1 active practitioner (single-doctor cabinet)', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A],
      isLoading: false,
      isError: false,
    });
    useAuthStore.setState({
      accessToken: 't',
      user: { id: MED_A.id, email: 'a@x', firstName: 'K', lastName: 'B', roles: ['MEDECIN'] },
    });

    renderPage();

    expect(screen.queryByLabelText('Filtrer par médecin')).not.toBeInTheDocument();
  });

  it('renders doctor pills + "Tous les médecins" when ≥ 2 practitioners', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    useAuthStore.setState({
      accessToken: 't',
      user: { id: 'sec1', email: 's@x', firstName: 'S', lastName: 'S', roles: ['SECRETAIRE'] },
    });

    renderPage();

    // Iso maquette : le filtre médecin est un groupe de pilules (.ag-docpill),
    // plus un <Select>. Une pilule par médecin + une pilule « Tous les médecins ».
    const group = screen.getByRole('group', { name: 'Filtrer par médecin' });
    expect(group).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /Tous les médecins/ })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /Bennani/ })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: /Idrissi/ })).toBeInTheDocument();
  });

  it('default = connected MEDECIN pill is active (aria-pressed) and drives the hook', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    useAuthStore.setState({
      accessToken: 't',
      user: { id: MED_A.id, email: 'a@x', firstName: 'K', lastName: 'B', roles: ['MEDECIN'] },
    });

    renderPage();

    const group = screen.getByRole('group', { name: 'Filtrer par médecin' });
    expect(within(group).getByRole('button', { name: /Bennani/ })).toHaveAttribute('aria-pressed', 'true');
    // Hook was called with a UUID, not 'ALL'.
    expect(useWeekAppointmentsMock).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ practitionerIdFilter: MED_A.id }),
    );
  });

  it('default = "Tous les médecins" pill active for SECRETAIRE / ADMIN', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    useAuthStore.setState({
      accessToken: 't',
      user: {
        id: 'sec1',
        email: 's@x',
        firstName: 'S',
        lastName: 'S',
        roles: ['SECRETAIRE'],
      },
    });

    renderPage();

    const group = screen.getByRole('group', { name: 'Filtrer par médecin' });
    expect(within(group).getByRole('button', { name: /Tous les médecins/ })).toHaveAttribute('aria-pressed', 'true');
    expect(useWeekAppointmentsMock).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ practitionerIdFilter: 'ALL' }),
    );
  });

  it('clicking a doctor pill drives the hook with the new practitionerIdFilter', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    useAuthStore.setState({
      accessToken: 't',
      user: { id: 'sec1', email: 's@x', firstName: 'S', lastName: 'S', roles: ['ADMIN'] },
    });

    renderPage();

    const group = screen.getByRole('group', { name: 'Filtrer par médecin' });
    fireEvent.click(within(group).getByRole('button', { name: /Idrissi/ }));

    // The latest call should use MED_B.id.
    const lastCallArgs = useWeekAppointmentsMock.mock.calls.at(-1);
    expect(lastCallArgs?.[1]).toEqual(
      expect.objectContaining({ practitionerIdFilter: MED_B.id }),
    );
  });

  it('persists explicit selection in localStorage', () => {
    usePractitionersMock.mockReturnValue({
      data: [MED_A, MED_B],
      isLoading: false,
      isError: false,
    });
    useAuthStore.setState({
      accessToken: 't',
      user: { id: 'sec1', email: 's@x', firstName: 'S', lastName: 'S', roles: ['ADMIN'] },
    });

    renderPage();

    const group = screen.getByRole('group', { name: 'Filtrer par médecin' });
    fireEvent.click(within(group).getByRole('button', { name: /Bennani/ }));

    expect(localStorage.getItem('agenda.practitionerFilter')).toBe(MED_A.id);

    // Cliquer « Tous les médecins » efface la sélection.
    fireEvent.click(within(group).getByRole('button', { name: /Tous les médecins/ }));
    expect(localStorage.getItem('agenda.practitionerFilter')).toBeNull();
  });
});
