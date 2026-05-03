/**
 * Smoke tests for Salle d'attente — screen 04.
 * Covers: desktop + mobile render with mocked fixtures, status pills,
 * allergy chips, KPI tiles, a11y (jest-axe).
 *
 * Per ADR-018: run only this suite during development:
 *   npm test -- --run features/salle-attente
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import SalleAttentePage from '../SalleAttentePage';
import SalleAttenteMobilePage from '../SalleAttentePage.mobile';
import { QUEUE, KPIS, UPCOMING } from '../fixtures';

vi.mock('../hooks/useQueue', () => ({
  useQueue: () => ({ queue: QUEUE, kpis: KPIS, upcoming: UPCOMING, isLoading: false, error: null }),
}));

vi.mock('../hooks/useCheckIn', () => ({
  useCheckIn: () => ({ checkIn: vi.fn().mockResolvedValue(undefined), isPending: false, error: null }),
}));

vi.mock('../hooks/useStartConsultation', () => ({
  useStartConsultation: () => ({
    startConsultation: vi.fn().mockResolvedValue({ id: 'c1' }),
    isPending: false,
    error: null,
  }),
}));

vi.mock('@/features/agenda/hooks/useAppointments', () => ({
  useWeekAppointments: () => ({
    days: [],
    appointments: [],
    rawAppointments: [],
    arrivals: [],
    weekLabel: '',
    todayKey: null,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
}));

// ── Helpers ──────────────────────────────────────────────

function renderDesktop() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/salle',        element: <SalleAttentePage /> },
      { path: '/agenda',       element: <div>Agenda</div> },
      { path: '/patients',     element: <div>Patients</div> },
      { path: '/facturation',  element: <div>Facturation</div> },
      { path: '/parametres',   element: <div>Paramètres</div> },
      { path: '/consultations',element: <div>Consultations</div> },
    ],
    { initialEntries: ['/salle'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function renderMobile() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/salle',   element: <SalleAttenteMobilePage /> },
      { path: '/agenda',  element: <div>Agenda</div> },
      { path: '/patients',element: <div>Patients</div> },
    ],
    { initialEntries: ['/salle'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// ── Desktop suite ────────────────────────────────────────

describe('<SalleAttentePage /> (desktop)', () => {
  it('renders Screen shell with "Salle d\'attente" title and subtitle', () => {
    const { container } = renderDesktop();
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent("Salle d'attente");
    expect(container.querySelector('.cp-topbar-sub')).toHaveTextContent('4 patients présents');
  });

  it('renders Liste and Déclarer arrivée action buttons', () => {
    renderDesktop();
    expect(screen.getByRole('button', { name: /Liste/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Déclarer arrivée/ })).toBeInTheDocument();
  });

  it('renders all 4 KPI tiles with correct labels and values', () => {
    renderDesktop();
    expect(screen.getByText('Arrivés')).toBeInTheDocument();
    expect(screen.getByText('Attente moyenne')).toBeInTheDocument();
    // "En consultation" appears in both the KPI label and a status pill
    expect(screen.getAllByText('En consultation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Retards')).toBeInTheDocument();
    // Value spot-checks
    expect(screen.getByText('2 en avance')).toBeInTheDocument();
    expect(screen.getByText('Objectif ≤ 15 min')).toBeInTheDocument();
    expect(screen.getByText('Dr. El Amrani · Box 1')).toBeInTheDocument();
    expect(screen.getByText('Aucun')).toBeInTheDocument();
  });

  it('renders the queue table with all 4 prototype patients', () => {
    renderDesktop();
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText('Fatima Z. Lahlou')).toBeInTheDocument();
    expect(screen.getByText('Youssef Ziani')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Cherkaoui')).toBeInTheDocument();
  });

  it('renders correct status pills for each patient', () => {
    renderDesktop();
    // "En consultation" appears in both KPI tile label and the status pill
    expect(screen.getAllByText('En consultation').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('En attente')).toBeInTheDocument();
    expect(screen.getByText('En constantes')).toBeInTheDocument();
    expect(screen.getByText('Arrivé')).toBeInTheDocument();
  });

  it('renders allergy chips for patients with allergies', () => {
    renderDesktop();
    expect(screen.getByText('Pénicilline')).toBeInTheDocument();
    expect(screen.getByText('Aspirine')).toBeInTheDocument();
  });

  it('renders the queue table with "File d\'attente" panel header', () => {
    renderDesktop();
    expect(screen.getByText("File d'attente")).toBeInTheDocument();
    expect(screen.getByText('Trié par heure d\'arrivée')).toBeInTheDocument();
  });

  it('renders CTA buttons matching patient statuses', () => {
    renderDesktop();
    // arrived → "Prendre constantes"
    expect(screen.getByRole('button', { name: /Prendre constantes/ })).toBeInTheDocument();
    // vitals → "Envoyer en consult."
    expect(screen.getByRole('button', { name: /Envoyer en consult\./ })).toBeInTheDocument();
    // waiting → "Appeler"
    expect(screen.getByRole('button', { name: /Appeler/ })).toBeInTheDocument();
  });

  it('renders the upcoming section with 3 not-yet-arrived patients', () => {
    renderDesktop();
    expect(screen.getByText(/RDV prévus/)).toBeInTheDocument();
    expect(screen.getByText('Samira Bennani')).toBeInTheDocument();
    expect(screen.getByText('Omar Idrissi')).toBeInTheDocument();
    expect(screen.getByText('Nadia Fassi')).toBeInTheDocument();
    // ETA
    expect(screen.getByText(/dans 1h 13min/)).toBeInTheDocument();
    // "Marquer arrivé" buttons (3)
    const markBtns = screen.getAllByRole('button', { name: /Marquer arrivé/ });
    expect(markBtns).toHaveLength(3);
  });

  it('has no serious a11y violations', async () => {
    const { container } = renderDesktop();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Mobile suite ─────────────────────────────────────────

describe('<SalleAttenteMobilePage />', () => {
  it('renders mobile shell with brand topbar', () => {
    const { container } = renderMobile();
    expect(container.querySelector('.mt-brand-name')).toHaveTextContent('careplus');
  });

  it('renders the screen title and a dynamic date/time line', () => {
    renderMobile();
    expect(screen.getByText("Salle d'attente")).toBeInTheDocument();
    // The date line is now derived from `new Date()`. Just assert it renders
    // a non-empty fr-MA date string instead of a hardcoded "Jeudi 24 avril".
    const subline = screen.getByText(/^[A-Za-zéèû]+ \d{1,2} [a-zéû]+ · \d{2}:\d{2}$/i);
    expect(subline).toBeInTheDocument();
  });

  it('renders 4 mobile KPI stat tiles', () => {
    renderMobile();
    expect(screen.getByText('À voir')).toBeInTheDocument();
    expect(screen.getByText('Attente moy.')).toBeInTheDocument();
    // "En consult." appears in both the KPI tile and a patient status pill
    expect(screen.getAllByText('En consult.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Total file')).toBeInTheDocument();
  });

  it('renders all 4 patients from the shared queue fixture', () => {
    renderMobile();
    // useQueue returns the desktop queue fixture (4 patients)
    expect(screen.getByText('Mohamed Alami')).toBeInTheDocument();
    expect(screen.getByText('Fatima Z. Lahlou')).toBeInTheDocument();
    expect(screen.getByText('Youssef Ziani')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Cherkaoui')).toBeInTheDocument();
  });

  it('renders mobile status pills', () => {
    renderMobile();
    // "En consult." appears in both KPI tile and status pill
    expect(screen.getAllByText('En consult.').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Constantes')).toBeInTheDocument();
    // "Confirmé" is the mobile label for 'waiting' status
    expect(screen.getByText('Confirmé')).toBeInTheDocument();
    expect(screen.getByText('Arrivé')).toBeInTheDocument();
  });

  it('renders allergy chips in the mobile card', () => {
    renderMobile();
    expect(screen.getByText('Pénicilline')).toBeInTheDocument();
    expect(screen.getByText('Aspirine')).toBeInTheDocument();
  });

  it('renders the bottom tab navigation', () => {
    renderMobile();
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderMobile();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
