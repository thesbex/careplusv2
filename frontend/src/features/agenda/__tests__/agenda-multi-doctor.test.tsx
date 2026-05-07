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
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders the dropdown with "Tous" + 2 doctor options when ≥ 2 practitioners', () => {
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

    const select = screen.getByLabelText('Filtrer par médecin') as HTMLSelectElement;
    expect(select).toBeInTheDocument();
    // First option = "Tous", then doctor A then doctor B.
    const labels = Array.from(select.options).map((o) => o.textContent ?? '');
    expect(labels[0]).toMatch(/Tous/);
    expect(labels.find((l) => l.includes('Bennani'))).toBeTruthy();
    expect(labels.find((l) => l.includes('Idrissi'))).toBeTruthy();
  });

  it('default value is the connected MEDECIN id (not "ALL")', () => {
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

    const select = screen.getByLabelText('Filtrer par médecin') as HTMLSelectElement;
    expect(select.value).toBe(MED_A.id);
    // Hook was called with a UUID, not 'ALL'.
    expect(useWeekAppointmentsMock).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ practitionerIdFilter: MED_A.id }),
    );
  });

  it('default value is "ALL" for SECRETAIRE / ADMIN', () => {
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

    const select = screen.getByLabelText('Filtrer par médecin') as HTMLSelectElement;
    expect(select.value).toBe('ALL');
    expect(useWeekAppointmentsMock).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ practitionerIdFilter: 'ALL' }),
    );
  });

  it('changing the dropdown drives the hook with the new practitionerIdFilter', () => {
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

    const select = screen.getByLabelText('Filtrer par médecin') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: MED_B.id } });

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

    const select = screen.getByLabelText('Filtrer par médecin') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: MED_A.id } });

    expect(localStorage.getItem('agenda.practitionerFilter')).toBe(MED_A.id);

    // Switching back to "Tous" clears it.
    fireEvent.change(select, { target: { value: 'ALL' } });
    expect(localStorage.getItem('agenda.practitionerFilter')).toBeNull();
  });
});
