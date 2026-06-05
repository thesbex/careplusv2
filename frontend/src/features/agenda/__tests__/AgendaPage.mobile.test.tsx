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
    weekLabel: '21 – 26 avr. 2026',
    todayKey: 'jeu',
    isLoading: false,
    error: null,
  }),
  ALL_PRACTITIONERS: 'ALL',
}));

vi.mock('../hooks/usePractitioners', () => ({
  usePractitioners: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('../hooks/useRooms', () => ({
  useRooms: () => ({ data: [], isLoading: false, isError: false }),
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
  it('renders the topbar with title "Agenda" + sub + Filter/Search icons (iso maquette mobile)', () => {
    const { container } = renderMobileAgenda();
    // Iso maquette : la topbar mobile porte "Agenda" + sous-titre + 2 icônes
    // à droite (Filter, Search). L'ancien rendu « brand » (logo careplus) est
    // remplacé — le branding vit dans la sidebar/onboarding, pas sur chaque
    // écran. Le sub est dérivé de la date sélectionnée.
    expect(container.querySelector('.mt-title')).toHaveTextContent('Agenda');
    expect(container.querySelector('.mt-sub')).not.toBeEmptyDOMElement();
    expect(screen.getByRole('button', { name: /filtres/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Rechercher un patient/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('renders a 7-day tab strip (Mon–Sun) with one tab selected', () => {
    renderMobileAgenda();
    const tablist = screen.getByRole('tablist', { name: 'Jour' });
    expect(tablist).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(7);
    const selected = tabs.filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
  });

  it('renders 1-letter day labels (L M M J V S D) per maquette + full a11y name', () => {
    renderMobileAgenda();
    const tabs = screen.getAllByRole('tab');
    // 1-letter visual labels (M apparaît 2× pour Mardi+Mercredi — c'est OK,
    // les tests sélectionnent par index ou aria-label). Dimanche (« D ») ajouté
    // avec la semaine 7 jours (iso maquette agenda calm premium).
    const visualLabels = tabs.map((t) => t.querySelector('.dl')?.textContent);
    expect(visualLabels).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);
    // Le nom accessible doit rester complet (« Lundi 21 », « Mardi 22 »…).
    expect(tabs[0]?.getAttribute('aria-label')).toMatch(/Lundi/);
    expect(tabs[2]?.getAttribute('aria-label')).toMatch(/Mercredi/);
  });

  it('renders appointments for the selected day', () => {
    renderMobileAgenda();
    // At least one appointment should be visible for the default selected day
    const blocks = document.querySelectorAll('.m-tl-block');
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('switching to Mercredi shows Ahmed Cherkaoui with Aspirine allergy', () => {
    renderMobileAgenda();
    // Sélection par aria-label complet — les tabs n'ont plus que la lettre
    // « M » dans leur textContent, donc on ne peut plus filtrer par texte
    // visible (collision Mardi/Mercredi).
    const merTab = screen.getAllByRole('tab').find(
      (t) => (t.getAttribute('aria-label') ?? '').startsWith('Mercredi'),
    );
    expect(merTab).toBeDefined();
    fireEvent.click(merTab!);
    expect(screen.getByText('Ahmed Cherkaoui')).toBeInTheDocument();
    expect(screen.getByText('Aspirine')).toBeInTheDocument();
  });

  it('switching to Lundi shows Mohamed Alami', () => {
    renderMobileAgenda();
    const lunTab = screen.getAllByRole('tab').find(
      (t) => (t.getAttribute('aria-label') ?? '').startsWith('Lundi'),
    );
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
