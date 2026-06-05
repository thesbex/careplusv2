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
    rawAppointments: [],
    arrivals: ARRIVALS,
    weekLabel: '21 – 26 avr. 2026',
    todayKey: 'jeu',
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
  useMonthAppointments: () => ({ appointments: [], isLoading: false }),
  ALL_PRACTITIONERS: 'ALL',
}));

vi.mock('../hooks/usePractitioners', () => ({
  usePractitioners: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('../hooks/useRooms', () => ({
  useRooms: () => ({ data: [], isLoading: false, isError: false }),
}));

vi.mock('@/features/parametres/hooks/useLeaves', () => ({
  useLeaves: () => ({ leaves: [], isLoading: false, error: null }),
}));

vi.mock('@/features/salle-attente/hooks/useQueue', () => ({
  useQueue: () => ({
    // Fixture queue : 3 entries — only those with status arrived/vitals/consult
    // are surfaced to the agenda right panel as Arrivées.
    queue: [
      { name: 'Mohamed Alami',   apt: '09:00', status: 'consult', arrived: '08:55', allergy: 'Pénicilline', age: 58, reason: 'Consultation', isPremium: false, room: '—', waited: '15 min' },
      { name: 'Youssef Ziani',   apt: '10:00', status: 'vitals',  arrived: '09:51', age: 32, reason: 'Première', isPremium: false, room: '—', waited: '8 min' },
      { name: 'Ahmed Cherkaoui', apt: '15:00', status: 'arrived', arrived: '14:58', allergy: 'Aspirine', age: 47, reason: 'Suivi HTA', isPremium: false, room: '—', waited: '2 min' },
    ],
    kpis: [],
    upcoming: [],
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
  it('renders Screen shell with Agenda title and dynamic week sub', () => {
    const { container } = renderAgenda();
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent('Agenda');
    // sub is the dynamic weekLabel — just check it's non-empty
    expect(container.querySelector('.cp-topbar-sub')).not.toBeEmptyDOMElement();
  });

  it('topbar carries Nouveau RDV only — Appel rapide + Imprimer retirés 2026-05-28', () => {
    renderAgenda();
    // Seul Nouveau RDV reste — Appel rapide (redondant avec la search topbar)
    // et Imprimer (non utilisé, pas de print agenda dans le flux secrétaire)
    // ont été supprimés. Ne pas réintroduire sans demande explicite.
    expect(screen.getByRole('button', { name: /Nouveau RDV/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Appel rapide/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Imprimer$/ })).toBeNull();
  });

  it('inline legend in toolbar RETIRÉE (2026-05-28) — la bottom legend la remplace en multi-praticien', () => {
    const { container } = renderAgenda();
    // L'ancien `.ag-legend` inline du toolbar a été supprimé : il faisait
    // doublon avec `.ag-week-legend` (qui rend Médecins + Statuts en
    // multi-praticien). Ni l'un ni l'autre ne doit apparaître ici car le
    // test renderAgenda mock 0 praticiens — donc même la bottom legend ne
    // s'affiche pas (condition activePractitioners.length >= 2).
    const toolbar = container.querySelector('.ag-toolbar');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.querySelector('.ag-legend')).toBeNull();
    expect(container.querySelector('.ag-legend-bottom')).toBeNull();
  });

  it('renders the pageDate in the topbar ("Weekday DD month YYYY · HH:MM")', () => {
    const { container } = renderAgenda();
    // .cp-topbar-right contient pageDate en première position devant la cloche.
    // Le format vient de toLocaleDateString('fr-FR', {weekday, day, month, year})
    // + " · HH:MM". On valide la forme, pas la valeur (test agnostique de la date).
    const topbarRight = container.querySelector('.cp-topbar-right');
    expect(topbarRight).not.toBeNull();
    const firstChild = topbarRight?.firstElementChild;
    expect(firstChild?.textContent).toMatch(/^[A-ZÀ-Ý][a-zà-ÿ]+ \d{1,2} \p{L}+ \d{4} · \d{2}:\d{2}$/u);
  });

  it('renders the week toolbar with Jour/Semaine/Mois view toggle', () => {
    renderAgenda();
    // weekLabel is dynamic — just check something is rendered in the toolbar area
    const group = screen.getByRole('group', { name: 'Période' });
    const semaine = within(group).getByRole('button', { name: 'Semaine' });
    expect(semaine).toHaveAttribute('aria-pressed', 'true');
    // Jour and Mois are not selected
    expect(within(group).getByRole('button', { name: 'Jour' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(group).getByRole('button', { name: 'Mois' })).toHaveAttribute('aria-pressed', 'false');
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
    // Allergy indicator for Ahmed Cherkaoui (Aspirine, Wed 15:00). Son créneau
    // de 15 min est rendu en bloc « compact » → l'allergie est une pastille
    // titrée (« Allergie : Aspirine »), pas du texte. (Avant, ce test trouvait
    // « Aspirine » dans l'ancien panneau « Arrivées du jour », remplacé par le
    // rail Calm Premium.)
    expect(screen.getByTitle('Allergie : Aspirine')).toBeInTheDocument();
  });

  it('renders the now-line on Jeudi (today) with the wall-clock label', () => {
    const { container } = renderAgenda();
    // The now-line label is derived from the real Date — it used to be
    // hardcoded to "09:47" from the design fixture, which leaked into
    // production on weekends as a phantom line at 09:47 on Thursday.
    // Just assert the line is rendered with a HH:MM label.
    const lbl = container.querySelector('.ag-now-lbl');
    expect(lbl).not.toBeNull();
    expect(lbl?.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it('renders the agenda rail (« Calm Premium ») — stats jour + prochains RDV + salle d\'attente', () => {
    renderAgenda();
    // Le rail remplace l'ancien panneau « Arrivées du jour » (iso maquette
    // agenda calm premium). Carte « Prochains RDV » toujours rendue.
    expect(screen.getByText('Prochains RDV')).toBeInTheDocument();
    // Carte accent « Salle d'attente » : compteur = file réelle (3 entrées
    // arrived/vitals/consult dans le mock useQueue) + CTA vers /salle.
    const waitingCard = screen.getByRole('button', { name: /Ouvrir la salle d'attente/ });
    expect(waitingCard).toHaveTextContent(/Salle d'attente/);
    expect(waitingCard).toHaveTextContent('3');
    expect(waitingCard).toHaveTextContent(/patients en attente/);
  });

  it('has no serious a11y violations', async () => {
    const { container } = renderAgenda();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  // ── Jour view (iso-design from design-handoff-v2 / `screens/agenda.jsx::AgendaJour`) ──
  describe('Jour view', () => {
    async function switchToJour(): Promise<void> {
      const { default: userEvent } = await import('@testing-library/user-event');
      const u = userEvent.setup();
      const group = screen.getByRole('group', { name: 'Période' });
      await u.click(within(group).getByRole('button', { name: 'Jour' }));
    }

    it('subtitle shows day label only — count lives in the header cell ("<Day> <N> <month> <YYYY>")', async () => {
      const { container } = renderAgenda();
      await switchToJour();
      const sub = container.querySelector('.cp-topbar-sub');
      // Per design-handoff-v2 / `screens/agenda.jsx::AgendaJourScreen`, the
      // toolbar subtitle is just "Jeudi 23 avril 2026" — the count lives in
      // the day header cell ("X RDV programmés"), not duplicated here.
      expect(sub?.textContent).toMatch(/^[A-Z][a-zéû]+ \d{1,2} \p{L}+ \d{4}$/u);
    });

    it('header cell carries the `today` class regardless of actual today', async () => {
      const { container } = renderAgenda();
      await switchToJour();
      // After switch, only the selected day's header cell remains (besides the
      // hour-column placeholder). It must have the today highlight.
      const headerCells = container.querySelectorAll('.ag-header-cell');
      const dayCells = Array.from(headerCells).filter((c) => c.textContent?.trim());
      expect(dayCells).toHaveLength(1);
      expect(dayCells[0]?.className).toMatch(/\btoday\b/);
    });

    it('header cell shows "X RDV programmés" right-aligned suffix', async () => {
      const { container } = renderAgenda();
      await switchToJour();
      const count = container.querySelector('.ag-day-count');
      expect(count).not.toBeNull();
      expect(count?.textContent).toMatch(/^\d+ RDV programmés$/);
    });

    it('day column carries the `today` class (gradient timeline tint)', async () => {
      const { container } = renderAgenda();
      await switchToJour();
      const cols = container.querySelectorAll('.ag-daycol');
      expect(cols).toHaveLength(1);
      expect(cols[0]?.className).toMatch(/\btoday\b/);
    });
  });
});
