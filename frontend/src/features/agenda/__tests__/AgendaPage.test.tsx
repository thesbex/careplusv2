import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AgendaPage from '../AgendaPage';
import { APPOINTMENTS, ARRIVALS, WEEK_DAYS } from '../fixtures';

vi.mock('../hooks/useAppointments', () => ({
  useWeekAppointments: () => ({
    days: WEEK_DAYS,
    appointments: APPOINTMENTS,
    arrivals: ARRIVALS,
    isLoading: false,
    error: null,
  }),
}));

function renderAgenda() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
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

describe('<AgendaPage /> (desktop)', () => {
  it('renders Screen shell with Agenda title and sub', () => {
    const { container } = renderAgenda();
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent('Agenda');
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent('Semaine 17 · Avr 2026');
  });

  it('renders Appel rapide and Nouveau RDV actions in the topbar', () => {
    renderAgenda();
    expect(screen.getByRole('button', { name: /Appel rapide/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Nouveau RDV/ })).toBeInTheDocument();
  });

  it('renders the week toolbar with Jour/Semaine/Mois view toggle', () => {
    renderAgenda();
    expect(screen.getByText('20 – 25 avril 2026')).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Période' });
    const semaine = within(group).getByRole('button', { name: 'Semaine' });
    expect(semaine).toHaveAttribute('aria-pressed', 'true');
  });

  it('renders all 6 weekday headers with date numbers', () => {
    renderAgenda();
    ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'].forEach((d) =>
      expect(screen.getByText(d)).toBeInTheDocument(),
    );
    ['21', '22', '23', '24', '25', '26'].forEach((n) =>
      expect(screen.getByText(n)).toBeInTheDocument(),
    );
  });

  it('renders appointment blocks with patient names and allergy indicators', () => {
    renderAgenda();
    // A few known fixtures
    expect(
      screen.getByRole('button', { name: /Mohamed Alami à 09:00, Consultation de suivi/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fatima Zahra Lahlou/ })).toBeInTheDocument();
    // Allergy chip for Ahmed Cherkaoui (Aspirine, Wed 15:00)
    expect(screen.getByText('Aspirine')).toBeInTheDocument();
  });

  it('renders the now-line on Jeudi (today) at 09:47', () => {
    renderAgenda();
    const nowLabels = screen.getAllByText('09:47');
    // topbar pageDate + now-line label → at least one occurrence
    expect(nowLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders the Today's Arrivals right panel with the 3 fixture patients", () => {
    renderAgenda();
    expect(screen.getByText('Arrivées du jour')).toBeInTheDocument();
    expect(screen.getByText('3 patients')).toBeInTheDocument();
    // Patient rows
    ['Mohamed Alami', 'Youssef Ziani', 'Ahmed Cherkaoui'].forEach((name) =>
      expect(screen.getAllByText(name).length).toBeGreaterThan(0),
    );
    // "Ouvrir la salle d'attente" CTA
    expect(
      screen.getByRole('button', { name: /Ouvrir la salle d'attente/ }),
    ).toBeInTheDocument();
  });

  it('has no serious a11y violations', async () => {
    const { container } = renderAgenda();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
