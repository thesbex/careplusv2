/**
 * UtilisateursTab — rôle RÉCEPTIONNISTE gated sur la capacité hospitalisation (V062).
 *
 * Pinne :
 *   1. hospitalizationEnabled = false → option RECEPTIONNISTE absente du <select>.
 *   2. hospitalizationEnabled = true  → option RECEPTIONNISTE présente.
 *   3. establishmentType = CLINIQUE   → option présente même sans le flag explicite.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

function mockClinic(clinic: Record<string, unknown> | null) {
  apiMock.get.mockImplementation((url: string) => {
    if (url === '/admin/users') return Promise.resolve({ data: [] });
    if (url === '/practitioners') return Promise.resolve({ data: [] });
    if (url === '/settings/clinic') return Promise.resolve({ data: clinic });
    return Promise.resolve({ data: null });
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
});

describe('UtilisateursTab — rôle RÉCEPTIONNISTE (V062)', () => {
  it('1. hospitalisation désactivée → option RECEPTIONNISTE absente', async () => {
    mockClinic({ hospitalizationEnabled: false, establishmentType: 'CABINET' });
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    const select = await screen.findByLabelText('Rôle');
    expect(
      within(select).queryByRole('option', { name: 'Réceptionniste' }),
    ).toBeNull();
  });

  it('2. hospitalizationEnabled = true → option RECEPTIONNISTE présente', async () => {
    mockClinic({ hospitalizationEnabled: true, establishmentType: 'CABINET' });
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    const select = await screen.findByLabelText('Rôle');
    await waitFor(() =>
      expect(
        within(select).getByRole('option', { name: 'Réceptionniste' }),
      ).toBeInTheDocument(),
    );
  });

  it('3. establishmentType = CLINIQUE → option RECEPTIONNISTE présente', async () => {
    mockClinic({ establishmentType: 'CLINIQUE' });
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    const select = await screen.findByLabelText('Rôle');
    await waitFor(() =>
      expect(
        within(select).getByRole('option', { name: 'Réceptionniste' }),
      ).toBeInTheDocument(),
    );
  });
});
