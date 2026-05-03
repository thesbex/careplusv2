import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AgendaMobilePage from '../AgendaPage.mobile';
import { WEEK_DAYS, APPOINTMENTS, ARRIVALS } from '../fixtures';

vi.mock('../hooks/useAppointments', () => ({
  useWeekAppointments: () => ({
    days: WEEK_DAYS,
    appointments: APPOINTMENTS,
    arrivals: ARRIVALS,
    isLoading: false,
    error: null,
  }),
}));

function renderMobileAgenda() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/agenda', element: <AgendaMobilePage /> },
      { path: '/salle', element: <div>Salle</div> },
      { path: '/rdv/new', element: <div>Nouveau RDV</div> },
    ],
    { initialEntries: ['/agenda'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<AgendaMobilePage />', () => {
  it('renders the mobile shell with brand topbar and bottom tabs', () => {
    const { container } = renderMobileAgenda();
    expect(container.querySelector('.mt-brand-name')).toHaveTextContent('careplus');
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('renders a 6-day tab strip (Mon–Sat) with one tab selected', () => {
    renderMobileAgenda();
    const tablist = screen.getByRole('tablist', { name: 'Jour' });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(6);
    const selected = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
  });

  it('renders all 6 day labels', () => {
    renderMobileAgenda();
    ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('renders appointments for the selected day', () => {
    renderMobileAgenda();
    // At least one appointment should be visible for the default selected day
    const blocks = document.querySelectorAll('.m-tl-block');
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('switching to Mercredi shows Ahmed Cherkaoui with Aspirine allergy', () => {
    renderMobileAgenda();
    const tabs = screen.getAllByRole('tab');
    const merTab = tabs.find((t) => t.textContent?.includes('Mer'));
    expect(merTab).toBeDefined();
    fireEvent.click(merTab!);
    expect(screen.getByText('Ahmed Cherkaoui')).toBeInTheDocument();
    expect(screen.getByText('Aspirine')).toBeInTheDocument();
  });

  it('switching to Lundi shows Mohamed Alami', () => {
    renderMobileAgenda();
    const tabs = screen.getAllByRole('tab');
    const lunTab = tabs.find((t) => t.textContent?.includes('Lun'));
    expect(lunTab).toBeDefined();
    fireEvent.click(lunTab!);
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
  });

  it('renders the FAB for new RDV', () => {
    renderMobileAgenda();
    expect(screen.getByRole('button', { name: 'Nouveau RDV' })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderMobileAgenda();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
