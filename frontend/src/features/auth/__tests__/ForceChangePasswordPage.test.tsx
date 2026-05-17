/**
 * V044 — ForceChangePasswordPage.
 *
 * Pinne :
 *   1. Le form rend les trois champs + bouton, et bloque < 12 chars.
 *   2. Submit OK → POST /users/me/change-password, flag cleared, redirige /agenda.
 *   3. Erreur INVALID_CURRENT_PASSWORD → message lisible, pas de redirect.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { AxiosError } from 'axios';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from '@/lib/api/client';
import ForceChangePasswordPage from '../ForceChangePasswordPage';
import { useAuthStore } from '@/lib/auth/authStore';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/force-change-password', element: <ForceChangePasswordPage /> },
      { path: '/agenda', element: <div data-testid="agenda-page">Agenda</div> },
    ],
    { initialEntries: ['/force-change-password'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  useAuthStore.setState({
    accessToken: 'token',
    user: {
      id: 'u-1',
      email: 'fatima@cabinet.ma',
      firstName: 'Fatima',
      lastName: 'Zahra',
      roles: ['SECRETAIRE'],
      passwordChangeRequired: true,
    },
  });
});

describe('<ForceChangePasswordPage />', () => {
  it('1. renders the three fields and rejects passwords < 12 chars', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', {
        name: 'Définissez votre nouveau mot de passe',
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe actuel')).toBeInTheDocument();
    expect(screen.getByLabelText('Nouveau mot de passe')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirmer')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'old-pwd');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'short');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'short');
    await userEvent.click(
      screen.getByRole('button', { name: /Valider et continuer/i }),
    );

    expect(
      await screen.findByText(
        'Le nouveau mot de passe doit faire au moins 12 caractères.',
      ),
    ).toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('2. submits the change, clears the flag, and redirects to /agenda', async () => {
    apiMock.post.mockResolvedValue({ data: undefined });
    renderPage();

    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'Old-Pwd-2026!');
    await userEvent.type(
      screen.getByLabelText('Nouveau mot de passe'),
      'Brand-New-Pwd-2026!',
    );
    await userEvent.type(screen.getByLabelText('Confirmer'), 'Brand-New-Pwd-2026!');
    await userEvent.click(
      screen.getByRole('button', { name: /Valider et continuer/i }),
    );

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/users/me/change-password', {
        currentPassword: 'Old-Pwd-2026!',
        newPassword: 'Brand-New-Pwd-2026!',
      });
    });

    await waitFor(() => {
      expect(useAuthStore.getState().user?.passwordChangeRequired).toBe(false);
    });
    await waitFor(() => {
      expect(screen.getByTestId('agenda-page')).toBeInTheDocument();
    });
  });

  it('3. surfaces INVALID_CURRENT_PASSWORD inline without redirecting', async () => {
    const axiosErr = new AxiosError('Bad request');
    axiosErr.response = {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      config: {} as never,
      data: {
        title: 'INVALID_CURRENT_PASSWORD',
        status: 400,
        code: 'INVALID_CURRENT_PASSWORD',
        detail: 'Le mot de passe actuel est incorrect.',
      },
    };
    apiMock.post.mockRejectedValue(axiosErr);

    renderPage();

    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'Wrong-Pwd-2026!');
    await userEvent.type(
      screen.getByLabelText('Nouveau mot de passe'),
      'Brand-New-Pwd-2026!',
    );
    await userEvent.type(screen.getByLabelText('Confirmer'), 'Brand-New-Pwd-2026!');
    await userEvent.click(
      screen.getByRole('button', { name: /Valider et continuer/i }),
    );

    expect(
      await screen.findByText('Le mot de passe actuel est incorrect.'),
    ).toBeInTheDocument();
    // Still on the force-change page (flag stays TRUE)
    expect(screen.queryByTestId('agenda-page')).toBeNull();
    expect(useAuthStore.getState().user?.passwordChangeRequired).toBe(true);
  });
});
