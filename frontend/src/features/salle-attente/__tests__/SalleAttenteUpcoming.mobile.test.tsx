import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import SalleAttenteMobilePage from '../SalleAttentePage.mobile';

const TODAY = new Date();
function todayAt(h: number, m: number) {
  const d = new Date(TODAY);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

vi.mock('../hooks/useQueue', () => ({
  useQueue: () => ({
    queue: [],
    kpis: [
      { label: 'En attente', value: '0', sub: 'patients' },
      { label: 'Attente moy.', value: '0', unit: 'min', sub: 'depuis arrivée' },
    ],
    upcoming: [],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useStartConsultation', () => ({
  useStartConsultation: () => ({
    startConsultation: vi.fn().mockResolvedValue({ id: 'c1' }),
    isPending: false,
    error: null,
  }),
}));

const checkInMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../hooks/useCheckIn', () => ({
  useCheckIn: () => ({
    checkIn: checkInMock,
    isPending: false,
    error: null,
  }),
}));

// Provide today's appointments (PLANIFIE/CONFIRME) via the underlying agenda hook.
vi.mock('@/features/agenda/hooks/useAppointments', () => ({
  useWeekAppointments: () => ({
    days: [],
    appointments: [],
    rawAppointments: [
      {
        id: 'apt-future-1',
        patientId: 'pat-1',
        patientFullName: 'Mohamed Alami',
        reasonLabel: 'Suivi HTA',
        startAt: todayAt(23, 30),
        endAt: todayAt(23, 50),
        status: 'CONFIRME',
      },
      {
        id: 'apt-future-2',
        patientId: 'pat-2',
        patientFullName: 'Fatima Z. Lahlou',
        reasonLabel: null,
        startAt: todayAt(23, 45),
        endAt: todayAt(24, 0),
        status: 'PLANIFIE',
      },
      // Already arrived — should NOT appear in upcoming
      {
        id: 'apt-arrived',
        patientId: 'pat-3',
        patientFullName: 'Already Here',
        reasonLabel: null,
        startAt: todayAt(8, 0),
        endAt: todayAt(8, 20),
        status: 'ARRIVE',
      },
    ],
    arrivals: [],
    weekLabel: 'cette semaine',
    todayKey: 'lun',
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/salle', element: <SalleAttenteMobilePage /> }],
    { initialEntries: ['/salle'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<SalleAttenteMobilePage /> — upcoming section NRG', () => {
  it('renders the "À venir aujourd\'hui" section with not-yet-arrived patients', () => {
    renderPage();
    expect(screen.getByText(/À venir aujourd/i)).toBeInTheDocument();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText('Fatima Z. Lahlou')).toBeInTheDocument();
    // Arrived patient must NOT be in the upcoming list
    expect(screen.queryByText('Already Here')).not.toBeInTheDocument();
  });

  it('tapping an upcoming row triggers check-in for that appointmentId', async () => {
    renderPage();
    const row = screen
      .getByText('Mohamed Alami')
      .closest('button.m-row') as HTMLButtonElement;
    fireEvent.click(row);
    await waitFor(() => expect(checkInMock).toHaveBeenCalledWith('apt-future-1'));
  });

  it('shows the empty queue copy when queue is empty', () => {
    renderPage();
    expect(screen.getByText('Aucun patient présent')).toBeInTheDocument();
  });
});
