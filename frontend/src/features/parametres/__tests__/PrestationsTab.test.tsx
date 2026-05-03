/**
 * PrestationsTab — onglet Paramètres > Prestations (V016).
 *
 * Pinne :
 *   1. La liste affiche le catalogue (incluant inactifs).
 *   2. POST /catalog/prestations envoyé sur Ajouter.
 *   3. PUT /catalog/prestations/:id envoyé sur Enregistrer.
 *   4. DELETE /catalog/prestations/:id envoyé sur ⌫.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// jsdom n'a pas confirm() — on l'auto-OK.
beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

import { api } from '@/lib/api/client';
import { PrestationsTab } from '../components/PrestationsTab';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const CATALOG = [
  { id: 'p-ecg', code: 'ECG', label: 'Électrocardiogramme', defaultPrice: 200, active: true, sortOrder: 1 },
  { id: 'p-piq', code: 'PIQURE', label: 'Piqûre', defaultPrice: 50, active: true, sortOrder: 2 },
];

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  apiMock.get.mockResolvedValue({ data: CATALOG });
  apiMock.post.mockResolvedValue({ data: { id: 'new', code: 'X', label: 'X', defaultPrice: 0, active: true, sortOrder: 0 } });
  apiMock.put.mockResolvedValue({ data: CATALOG[0] });
  apiMock.delete.mockResolvedValue({ data: undefined });
});

describe('PrestationsTab', () => {
  it('1. liste catalogue (avec inactifs)', async () => {
    render(withClient(<PrestationsTab />));
    await screen.findByDisplayValue('Électrocardiogramme');
    expect(screen.getByDisplayValue('Piqûre')).toBeInTheDocument();
    // includeInactive est passé à l'API.
    expect(apiMock.get).toHaveBeenCalledWith('/catalog/prestations', expect.objectContaining({
      params: { includeInactive: true },
    }));
  });

  it('2. POST sur Ajouter', async () => {
    render(withClient(<PrestationsTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle prestation' }));
    await userEvent.type(screen.getByLabelText('Code *'), 'ECHO');
    await userEvent.type(screen.getByLabelText('Libellé *'), 'Échographie');
    fireEvent.change(screen.getByLabelText('Tarif (MAD) *'), { target: { value: '350' } });
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    const [url, body] = apiMock.post.mock.calls[0]!;
    expect(url).toBe('/catalog/prestations');
    expect(body).toMatchObject({ code: 'ECHO', label: 'Échographie', defaultPrice: 350 });
  });

  it('3. PUT sur Enregistrer après edit inline', async () => {
    render(withClient(<PrestationsTab />));
    const labelInput = await screen.findByDisplayValue('Électrocardiogramme');
    fireEvent.change(labelInput, { target: { value: 'ECG 12 dérivations' } });
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(apiMock.put).toHaveBeenCalled());
    const [url, body] = apiMock.put.mock.calls[0]!;
    expect(url).toBe('/catalog/prestations/p-ecg');
    expect(body).toMatchObject({ label: 'ECG 12 dérivations', code: 'ECG' });
  });

  it('4. DELETE sur le bouton ⌫', async () => {
    render(withClient(<PrestationsTab />));
    const btn = await screen.findByRole('button', { name: 'Supprimer Électrocardiogramme' });
    await userEvent.click(btn);
    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/catalog/prestations/p-ecg'));
  });
});
