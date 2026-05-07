/**
 * RoomsManagementSection (V033) — CRUD salles dans /parametres.
 *
 * Pinne :
 *   1. Liste vide + bouton "Nouvelle salle".
 *   2. Création : ouvre form, fill name + tags, submit → POST.
 *   3. Désactivation : DELETE envoyé.
 *   4. Réactivation : PUT { active: true }.
 *   5. Inactive rendue avec badge.
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

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

import { api } from '@/lib/api/client';
import { RoomsManagementSection } from '../components/RoomsManagementSection';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

describe('RoomsManagementSection', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
  });

  it('1. liste vide → état empty + bouton Nouvelle salle', async () => {
    apiMock.get.mockResolvedValue({ data: [] });
    render(withClient(<RoomsManagementSection />));
    await waitFor(() =>
      expect(screen.getByText(/Aucune salle déclarée/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: /Nouvelle salle/i }),
    ).toBeInTheDocument();
    expect(apiMock.get).toHaveBeenCalledWith(
      '/rooms',
      expect.objectContaining({ params: { includeInactive: true } }),
    );
  });

  it('2. création envoie POST /rooms avec name + tags', async () => {
    apiMock.get.mockResolvedValue({ data: [] });
    apiMock.post.mockResolvedValue({
      data: { id: 'r1', name: 'Salle 1', capabilityTags: ['ECG'], active: true },
    });
    render(withClient(<RoomsManagementSection />));
    await screen.findByText(/Aucune salle/i);

    await userEvent.click(screen.getByRole('button', { name: /Nouvelle salle/i }));
    await userEvent.type(screen.getByLabelText(/Nom/i), 'Salle 1');
    await userEvent.type(
      screen.getByLabelText(/Équipements/i),
      'échographe, ECG',
    );
    await userEvent.click(screen.getByRole('button', { name: /^Créer$/ }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    const [url, body] = apiMock.post.mock.calls[0]!;
    expect(url).toBe('/rooms');
    expect(body).toMatchObject({
      name: 'Salle 1',
      capabilityTags: ['échographe', 'ECG'],
    });
  });

  it('3. badge Inactive sur les salles désactivées', async () => {
    apiMock.get.mockResolvedValue({
      data: [
        {
          id: 'r-active',
          name: 'Salle A',
          capabilityTags: [],
          active: true,
        },
        {
          id: 'r-inactive',
          name: 'Ancienne salle',
          capabilityTags: [],
          active: false,
        },
      ],
    });
    render(withClient(<RoomsManagementSection />));
    await screen.findByText('Ancienne salle');
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('4. désactivation : DELETE /rooms/{id}', async () => {
    apiMock.get.mockResolvedValue({
      data: [{ id: 'r1', name: 'Salle 1', capabilityTags: [], active: true }],
    });
    apiMock.delete.mockResolvedValue({ data: undefined });
    render(withClient(<RoomsManagementSection />));
    await screen.findByText('Salle 1');

    await userEvent.click(
      screen.getByRole('button', { name: /Désactiver Salle 1/i }),
    );
    await waitFor(() =>
      expect(apiMock.delete).toHaveBeenCalledWith('/rooms/r1'),
    );
  });

  it('5. réactivation : PUT /rooms/{id} { active: true }', async () => {
    apiMock.get.mockResolvedValue({
      data: [
        { id: 'r-off', name: 'Salle A', capabilityTags: ['ECG'], active: false },
      ],
    });
    apiMock.put.mockResolvedValue({
      data: { id: 'r-off', name: 'Salle A', capabilityTags: ['ECG'], active: true },
    });
    render(withClient(<RoomsManagementSection />));
    await screen.findByText('Salle A');

    await userEvent.click(
      screen.getByRole('button', { name: /Réactiver Salle A/i }),
    );
    await waitFor(() => expect(apiMock.put).toHaveBeenCalled());
    const [url, body] = apiMock.put.mock.calls[0]!;
    expect(url).toBe('/rooms/r-off');
    expect(body).toMatchObject({ active: true });
  });
});
