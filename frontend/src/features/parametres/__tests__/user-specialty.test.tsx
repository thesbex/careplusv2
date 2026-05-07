/**
 * UtilisateursTab — champ "Spécialité" (V032).
 *
 * Pinne :
 *   1. Rôle non-MEDECIN → champ specialty absent.
 *   2. Rôle MEDECIN → champ specialty rendu (optionnel).
 *   3. Submit MEDECIN avec specialty → POST contient le champ.
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
import { UtilisateursTab } from '../components/UtilisateursTab';

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

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  apiMock.get.mockImplementation((url: string) => {
    if (url === '/admin/users') return Promise.resolve({ data: [] });
    if (url === '/practitioners') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: null });
  });
});

describe('UtilisateursTab — champ Spécialité (V032)', () => {
  it('1. rôle non-MEDECIN → champ specialty absent', async () => {
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    expect(screen.queryByTestId('user-specialty-field')).toBeNull();
    // Sécurité : avec ASSISTANT et ADMIN aussi.
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'ASSISTANT');
    expect(screen.queryByTestId('user-specialty-field')).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'ADMIN');
    expect(screen.queryByTestId('user-specialty-field')).toBeNull();
  });

  it('2. rôle MEDECIN → champ specialty rendu', async () => {
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'MEDECIN');
    await waitFor(() =>
      expect(screen.getByTestId('user-specialty-field')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Spécialité')).toBeInTheDocument();
  });

  it('3. submit MEDECIN avec specialty → POST contient specialty', async () => {
    apiMock.post.mockResolvedValue({ data: {} });
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'MEDECIN');

    await userEvent.type(screen.getByLabelText('Email *'), 'med@cabinet.ma');
    await userEvent.type(
      screen.getByLabelText('Mot de passe initial *'),
      'longpassword12',
    );
    await userEvent.type(screen.getByLabelText('Prénom *'), 'Sofia');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Bennani');
    await userEvent.type(screen.getByLabelText('Spécialité'), 'Pédiatre');

    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    const [url, body] = apiMock.post.mock.calls[0]!;
    expect(url).toBe('/admin/users');
    expect(body).toMatchObject({
      email: 'med@cabinet.ma',
      roles: ['MEDECIN'],
      specialty: 'Pédiatre',
    });
  });
});
