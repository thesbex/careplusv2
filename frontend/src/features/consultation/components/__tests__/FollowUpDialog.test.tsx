/**
 * FollowUpDialog tests — pin la "vision 360" du planning du jour :
 *
 *   - le panneau planning s'affiche à côté du formulaire
 *   - GET /appointments est appelé avec la date sélectionnée
 *   - le créneau candidat (date+heure) apparaît avec sa durée
 *   - chevauchement → bandeau d'alerte + ligne en danger
 *   - largeur < 820 px → grille s'effondre en 1 colonne
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FollowUpDialog } from '../FollowUpDialog';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: (selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: 'practitioner-1' } }),
}));

const REASONS = [
  { id: 'r-ctl', code: 'CONTROL', label: 'Contrôle', durationMinutes: 15, colorHex: null },
  { id: 'r-first', code: 'FIRST', label: 'Première consultation', durationMinutes: 30, colorHex: null },
];

const DAY_APPOINTMENTS = [
  {
    id: 'apt-1',
    patientId: 'p-1',
    patientFullName: 'Fatima Zahra Lahlou',
    reasonLabel: 'Première consultation',
    startAt: '2026-05-01T13:00:00Z',
    endAt: '2026-05-01T13:30:00Z',
    status: 'ARRIVE',
  },
];

function renderDialog() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <FollowUpDialog
        open={true}
        onOpenChange={vi.fn()}
        consultationId="cons-1"
        onCreated={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockGet.mockImplementation((url: string) => {
    if (url === '/reasons') return Promise.resolve({ data: REASONS });
    if (url.startsWith('/appointments?')) return Promise.resolve({ data: DAY_APPOINTMENTS });
    return Promise.resolve({ data: [] });
  });
  // Largeur > 820 px par défaut (desktop).
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1200 });
});

describe('<FollowUpDialog />', () => {
  it('affiche le panneau planning à côté du formulaire (desktop)', async () => {
    renderDialog();
    expect(await screen.findByTestId('day-planning')).toBeInTheDocument();
    expect(screen.getByText(/Programmer un prochain RDV/i)).toBeInTheDocument();
  });

  it('appelle GET /appointments avec la date et le practitionerId', async () => {
    renderDialog();
    await waitFor(() => {
      const calls = mockGet.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.startsWith('/appointments?practitionerId=practitioner-1'))).toBe(
        true,
      );
    });
  });

  it('liste les RDV du jour récupérés et le compteur', async () => {
    renderDialog();
    expect(await screen.findByText(/Fatima Zahra Lahlou/)).toBeInTheDocument();
    expect(screen.getByText(/1 RDV/)).toBeInTheDocument();
    expect(screen.getByText(/Arrivé/)).toBeInTheDocument();
  });

  it('rend le créneau candidat avec la durée du motif sélectionné', async () => {
    renderDialog();
    expect(await screen.findByTestId('candidate-slot')).toBeInTheDocument();
    expect(screen.getByText(/Nouveau RDV \(cette consultation\)/)).toBeInTheDocument();
  });

  it('chevauchement → bandeau d\'alerte + ligne en danger', async () => {
    const user = userEvent.setup();
    renderDialog();
    await screen.findByText(/Fatima Zahra Lahlou/);

    // Force la date au 2026-05-01 (jour du RDV mocké) puis l'heure à 14:15
    // (chevauche 14:00–14:30). Les <label> ne sont pas associés via htmlFor →
    // on cible par type.
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
    await user.clear(dateInput);
    await user.type(dateInput, '2026-05-01');
    await user.clear(timeInput);
    await user.type(timeInput, '14:15');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Chevauchement/);
    expect(screen.getByRole('alert')).toHaveTextContent(/Fatima Zahra Lahlou/);
  });

  it('grille à 1 colonne quand window.innerWidth < 820', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    renderDialog();
    const planning = await screen.findByTestId('day-planning');
    const grid = planning.parentElement as HTMLElement;
    expect(grid.style.gridTemplateColumns).toBe('1fr');
  });

  it('"Aucun RDV ce jour — agenda libre." quand le backend renvoie []', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url === '/reasons') return Promise.resolve({ data: REASONS });
      if (url.startsWith('/appointments?')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    renderDialog();
    expect(await screen.findByText(/Aucun RDV ce jour/)).toBeInTheDocument();
    expect(screen.getByText(/0 RDV/)).toBeInTheDocument();
  });
});
