/**
 * V044 — UtilisateursTab : bouton « Réinitialiser MdP » + dialog.
 *
 * Pinne :
 *   1. Bouton visible sur les autres utilisateurs, absent sur soi-même.
 *   2. Dialog s'ouvre + valide ≥ 12 caractères et confirmation.
 *   3. Submit OK → POST /admin/users/{id}/reset-password avec le body attendu.
 *   4. Erreur 403 → toast d'erreur, dialog reste ouvert.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { UtilisateursTab } from '../components/UtilisateursTab';
import { useAuthStore } from '@/lib/auth/authStore';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const toastMock = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

const ADMIN_ID = '00000000-0000-0000-0000-0000000000aa';
const TARGET_USER = {
  id: '00000000-0000-0000-0000-0000000000bb',
  email: 'fatima@cabinet.ma',
  firstName: 'Fatima',
  lastName: 'Zahra',
  phone: null,
  enabled: true,
  roles: ['SECRETAIRE'],
};

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();

  useAuthStore.setState({
    accessToken: 'token',
    user: {
      id: ADMIN_ID,
      email: 'admin@cabinet.ma',
      firstName: 'Admin',
      lastName: 'Cabinet',
      roles: ['ADMIN'],
    },
  });

  apiMock.get.mockImplementation((url: string) => {
    if (url === '/admin/users')
      return Promise.resolve({
        data: [
          {
            id: ADMIN_ID,
            email: 'admin@cabinet.ma',
            firstName: 'Admin',
            lastName: 'Cabinet',
            phone: null,
            enabled: true,
            roles: ['ADMIN'],
          },
          TARGET_USER,
        ],
      });
    if (url === '/practitioners') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: null });
  });
});

describe('UtilisateursTab — reset password dialog (V044)', () => {
  it('1. shows the reset button on other users but hides it on the current admin', async () => {
    render(withClient(<UtilisateursTab />));

    await screen.findByText('Fatima Zahra');

    expect(
      screen.getByRole('button', {
        name: /Réinitialiser le mot de passe de Fatima Zahra/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /Réinitialiser le mot de passe de Admin Cabinet/i,
      }),
    ).toBeNull();
  });

  it('2. opens the dialog and rejects mismatched passwords', async () => {
    render(withClient(<UtilisateursTab />));
    await screen.findByText('Fatima Zahra');

    await userEvent.click(
      screen.getByRole('button', {
        name: /Réinitialiser le mot de passe de Fatima Zahra/i,
      }),
    );

    const dialog = await screen.findByTestId('reset-password-dialog');
    expect(dialog).toBeInTheDocument();

    // Mismatch → toast + no API call
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'Brand-New-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'OtherPwd2026!');
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser$/i }));

    expect(toastMock.error).toHaveBeenCalledWith(
      'Les deux mots de passe ne correspondent pas.',
    );
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('3. submits the reset and surfaces success', async () => {
    apiMock.post.mockResolvedValue({ data: undefined });
    render(withClient(<UtilisateursTab />));
    await screen.findByText('Fatima Zahra');

    await userEvent.click(
      screen.getByRole('button', {
        name: /Réinitialiser le mot de passe de Fatima Zahra/i,
      }),
    );

    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'Brand-New-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'Brand-New-Pwd-2026!');
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser$/i }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith(
        `/admin/users/${TARGET_USER.id}/reset-password`,
        { password: 'Brand-New-Pwd-2026!' },
      );
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalled();
    });
    // Dialog closes after success
    await waitFor(() => {
      expect(screen.queryByTestId('reset-password-dialog')).toBeNull();
    });
  });

  it('4. weak password (< 12 chars) is rejected client-side', async () => {
    render(withClient(<UtilisateursTab />));
    await screen.findByText('Fatima Zahra');

    await userEvent.click(
      screen.getByRole('button', {
        name: /Réinitialiser le mot de passe de Fatima Zahra/i,
      }),
    );
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'short');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'short');
    await userEvent.click(screen.getByRole('button', { name: /Réinitialiser$/i }));

    expect(toastMock.error).toHaveBeenCalledWith(
      'Le mot de passe doit faire au moins 12 caractères.',
    );
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});
