/**
 * PasswordChangeSection — self-service password change UI.
 *
 * Pins :
 *   1. Form rejects < 12-char passwords client-side.
 *   2. Form rejects mismatched confirm.
 *   3. Successful submit calls POST /users/me/change-password.
 *   4. INVALID_CURRENT_PASSWORD surfaces inline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError } from 'axios';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from '@/lib/api/client';
import { toast } from 'sonner';
import { PasswordChangeSection } from '../components/PasswordChangeSection';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};
const toastMock = toast as unknown as {
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

function withClient(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  toastMock.success.mockReset();
  toastMock.error.mockReset();
});

describe('<PasswordChangeSection />', () => {
  it('1. rejects passwords shorter than 12 chars', async () => {
    render(withClient(<PasswordChangeSection />));

    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'Old-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'short');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'short');
    await userEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));

    expect(
      await screen.findByText('Le nouveau mot de passe doit faire au moins 12 caractères.'),
    ).toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('2. rejects mismatched confirmation', async () => {
    render(withClient(<PasswordChangeSection />));

    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'Old-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'Brand-New-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'Different-Pwd-2026!');
    await userEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));

    expect(
      await screen.findByText('Les deux mots de passe ne correspondent pas.'),
    ).toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('3. submits via /users/me/change-password and resets the form on success', async () => {
    apiMock.post.mockResolvedValue({ data: undefined });
    render(withClient(<PasswordChangeSection />));

    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'Old-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'Brand-New-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'Brand-New-Pwd-2026!');
    await userEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/users/me/change-password', {
        currentPassword: 'Old-Pwd-2026!',
        newPassword: 'Brand-New-Pwd-2026!',
      });
    });
    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith('Mot de passe mis à jour.');
    });
    // Fields cleared
    expect((screen.getByLabelText('Mot de passe actuel') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Nouveau mot de passe') as HTMLInputElement).value).toBe('');
  });

  it('4. surfaces INVALID_CURRENT_PASSWORD inline', async () => {
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

    render(withClient(<PasswordChangeSection />));

    await userEvent.type(screen.getByLabelText('Mot de passe actuel'), 'Wrong-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'Brand-New-Pwd-2026!');
    await userEvent.type(screen.getByLabelText('Confirmer'), 'Brand-New-Pwd-2026!');
    await userEvent.click(screen.getByRole('button', { name: /Mettre à jour/i }));

    expect(
      await screen.findByText('Le mot de passe actuel est incorrect.'),
    ).toBeInTheDocument();
    expect(toastMock.success).not.toHaveBeenCalled();
  });
});
