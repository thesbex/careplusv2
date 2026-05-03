/**
 * ConsultationPrestationsPanel — bloc d'ajout / retrait de prestations
 * pendant une consultation (V016).
 *
 * Pinne :
 *   1. Le catalogue (mocké) est listé dans la combobox.
 *   2. L'ajout envoie {prestationId, unitPrice, quantity} au bon endpoint.
 *   3. Sélectionner une prestation auto-remplit le champ prix avec
 *      defaultPrice (snapshot UX, pas backend).
 *   4. Le total est la somme correcte des lineTotal.
 *   5. readOnly désactive l'ajout (pas de combobox / bouton Ajouter).
 *   6. readOnly désactive aussi le bouton ⌫ par ligne.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from '@/lib/api/client';
import { ConsultationPrestationsPanel } from '../components/ConsultationPrestationsPanel';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const CATALOG = [
  { id: 'p-ecg', code: 'ECG', label: 'ECG', defaultPrice: 200, active: true, sortOrder: 1 },
  { id: 'p-piq', code: 'PIQURE', label: 'Piqûre', defaultPrice: 50, active: true, sortOrder: 2 },
];

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

function setupMocks(items: unknown[] = []) {
  apiMock.get.mockImplementation((url: string) => {
    if (url === '/catalog/prestations') return Promise.resolve({ data: CATALOG });
    if (url.endsWith('/prestations')) return Promise.resolve({ data: items });
    return Promise.reject(new Error('unexpected GET ' + url));
  });
  apiMock.post.mockResolvedValue({ data: { id: 'new-link-id' } });
  apiMock.delete.mockResolvedValue({ data: undefined });
}

describe('ConsultationPrestationsPanel', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.delete.mockReset();
  });

  it('1. catalogue listé dans la combobox', async () => {
    setupMocks();
    render(withClient(<ConsultationPrestationsPanel consultationId="c1" />));
    await screen.findByRole('option', { name: /ECG/ });
    await screen.findByRole('option', { name: /Piqûre/ });
  });

  it('2. Ajouter envoie POST avec prestationId + unitPrice + quantity', async () => {
    setupMocks();
    render(withClient(<ConsultationPrestationsPanel consultationId="c1" />));
    await screen.findByRole('option', { name: /ECG/ });
    const combo = screen.getByLabelText(/Choisir une prestation/i);
    await userEvent.selectOptions(combo, 'p-ecg');

    const qty = screen.getByLabelText(/Quantité/i) as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '2' } });

    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    const call = apiMock.post.mock.calls[0]!;
    const url = call[0] as string;
    const body = call[1] as { prestationId: string; quantity: number; unitPrice: number };
    expect(url).toBe('/consultations/c1/prestations');
    expect(body).toMatchObject({ prestationId: 'p-ecg', quantity: 2 });
    expect(body.unitPrice).toBe(200);
  });

  it('3. Sélectionner une prestation auto-remplit le prix avec defaultPrice', async () => {
    setupMocks();
    render(withClient(<ConsultationPrestationsPanel consultationId="c1" />));
    await screen.findByRole('option', { name: /Piqûre/ });
    const combo = screen.getByLabelText(/Choisir une prestation/i);
    await userEvent.selectOptions(combo, 'p-piq');
    const price = screen.getByLabelText(/Prix unitaire/i) as HTMLInputElement;
    await waitFor(() => expect(price.value).toBe('50'));
  });

  it('4. Total = somme des lineTotal', async () => {
    setupMocks([
      { id: 'l1', consultationId: 'c1', prestationId: 'p-ecg', prestationCode: 'ECG', prestationLabel: 'ECG', unitPrice: 200, quantity: 1, lineTotal: 200, notes: null },
      { id: 'l2', consultationId: 'c1', prestationId: 'p-piq', prestationCode: 'PIQURE', prestationLabel: 'Piqûre', unitPrice: 50, quantity: 3, lineTotal: 150, notes: null },
    ]);
    render(withClient(<ConsultationPrestationsPanel consultationId="c1" />));
    await waitFor(() =>
      expect(screen.getByTestId('prestations-total').textContent).toContain('350'),
    );
  });

  it('5. readOnly cache la combobox + bouton Ajouter', async () => {
    setupMocks();
    render(withClient(<ConsultationPrestationsPanel consultationId="c1" readOnly />));
    expect(screen.queryByLabelText(/Choisir une prestation/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument();
  });

  it('6. readOnly cache aussi le bouton ⌫ par ligne', async () => {
    setupMocks([
      { id: 'l1', consultationId: 'c1', prestationId: 'p-ecg', prestationCode: 'ECG', prestationLabel: 'ECG', unitPrice: 200, quantity: 1, lineTotal: 200, notes: null },
    ]);
    render(withClient(<ConsultationPrestationsPanel consultationId="c1" readOnly />));
    await screen.findByText('ECG');
    expect(screen.queryByRole('button', { name: /Retirer/i })).not.toBeInTheDocument();
  });
});
