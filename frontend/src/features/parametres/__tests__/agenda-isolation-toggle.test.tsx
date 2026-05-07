/**
 * AgendaIsolationToggle (V032).
 *
 * Pinne :
 *   1. <2 médecins actifs → toggle absent.
 *   2. 2+ médecins → toggle rendu, default OFF.
 *   3. Click sur le toggle → PUT /settings/clinic { agendaStrictIsolation: true }.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/auth/authStore', () => {
  const state = { user: { roles: ['ADMIN'] } as { roles: string[] } | null };
  const useAuthStore = ((selector: (s: typeof state) => unknown) => selector(state)) as unknown as {
    (selector: (s: typeof state) => unknown): unknown;
  };
  return {
    useAuthStore,
    __setUser: (u: { roles: string[] } | null) => {
      state.user = u;
    },
  };
});

import { api } from '@/lib/api/client';
import { AgendaIsolationToggle } from '../components/AgendaIsolationToggle';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
};

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

const SETTINGS_OFF = {
  id: 's1',
  name: 'Cabinet',
  address: '24 rue X',
  city: 'Casa',
  phone: '+212522',
  email: null,
  inpe: null,
  cnom: null,
  ice: null,
  rib: null,
  agendaStrictIsolation: false,
};

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.put.mockReset();
});

describe('AgendaIsolationToggle', () => {
  it('1. <2 médecins → toggle absent', async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/practitioners') {
        return Promise.resolve({
          data: [
            {
              id: 'p1',
              firstName: 'A',
              lastName: 'B',
              specialty: null,
              active: true,
            },
          ],
        });
      }
      if (url === '/settings/clinic') {
        return Promise.resolve({ data: SETTINGS_OFF });
      }
      return Promise.resolve({ data: null });
    });
    const { container } = render(withClient(<AgendaIsolationToggle />));
    // Wait for queries to settle then check absence.
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="agenda-isolation-toggle"]')).toBeNull();
  });

  it('2. 2+ médecins → toggle rendu, default OFF', async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/practitioners') {
        return Promise.resolve({
          data: [
            { id: 'p1', firstName: 'A', lastName: 'B', specialty: null, active: true },
            { id: 'p2', firstName: 'C', lastName: 'D', specialty: 'Pédiatre', active: true },
          ],
        });
      }
      if (url === '/settings/clinic') {
        return Promise.resolve({ data: SETTINGS_OFF });
      }
      return Promise.resolve({ data: null });
    });
    render(withClient(<AgendaIsolationToggle />));
    const cb = (await screen.findByRole('switch')) as HTMLInputElement;
    expect(cb.checked).toBe(false);
    // Vérifie le label « Désactivé » du toggle (premier match suffit).
    expect(screen.getAllByText(/Désactivé/).length).toBeGreaterThan(0);
  });

  it('3. click → PUT /settings/clinic avec agendaStrictIsolation: true', async () => {
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/practitioners') {
        return Promise.resolve({
          data: [
            { id: 'p1', firstName: 'A', lastName: 'B', specialty: null, active: true },
            { id: 'p2', firstName: 'C', lastName: 'D', specialty: null, active: true },
          ],
        });
      }
      if (url === '/settings/clinic') {
        return Promise.resolve({ data: SETTINGS_OFF });
      }
      return Promise.resolve({ data: null });
    });
    apiMock.put.mockResolvedValue({ data: { ...SETTINGS_OFF, agendaStrictIsolation: true } });

    render(withClient(<AgendaIsolationToggle />));
    const cb = await screen.findByRole('switch');
    await userEvent.click(cb);

    await waitFor(() => expect(apiMock.put).toHaveBeenCalled());
    const [url, body] = apiMock.put.mock.calls[0]!;
    expect(url).toBe('/settings/clinic');
    expect(body).toMatchObject({ agendaStrictIsolation: true });
    // On envoie aussi les champs obligatoires pour ne pas violer @NotBlank.
    expect(body).toMatchObject({ name: 'Cabinet', address: '24 rue X' });
  });
});
