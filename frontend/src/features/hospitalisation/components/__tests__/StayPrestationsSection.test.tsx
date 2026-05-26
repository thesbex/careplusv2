/**
 * StayPrestationsSection — bloc prestations d'un séjour hospitalisation (QA10-2).
 *
 * Pinne :
 *   1. La liste des prestations existantes est rendue (label + lineTotal + total).
 *   2. Le catalogue (mocké) est listé dans la combobox.
 *   3. Sélectionner un acte préremplit label + prix (defaultPrice).
 *   4. « Ajouter » envoie POST { actId, label, unitPrice, quantity } au bon endpoint.
 *   5. La suppression (×) appelle DELETE.
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
import { StayPrestationsSection } from '../StayPanels';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const CATALOG = [
  { id: 'a-cons', code: 'CONS', label: 'Consultation', defaultPrice: 150, active: true, sortOrder: 1 },
  { id: 'a-o2', code: 'O2', label: 'Oxygène', defaultPrice: 80, active: true, sortOrder: 2 },
];

const LINES = [
  { id: 'l1', stayId: 's1', actId: 'a-cons', label: 'Consultation', unitPrice: 150, quantity: 1, lineTotal: 150, performedAt: '2026-05-26T09:00:00Z', createdBy: 'dr' },
  { id: 'l2', stayId: 's1', actId: null, label: 'Repas', unitPrice: 40, quantity: 3, lineTotal: 120, performedAt: '2026-05-26T12:00:00Z', createdBy: 'dr' },
];

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

function setupMocks(lines: unknown[] = []) {
  apiMock.get.mockImplementation((url: string) => {
    if (url === '/catalog/prestations') return Promise.resolve({ data: CATALOG });
    if (url.endsWith('/prestations')) return Promise.resolve({ data: lines });
    return Promise.reject(new Error('unexpected GET ' + url));
  });
  apiMock.post.mockResolvedValue({ data: { id: 'new-id' } });
  apiMock.delete.mockResolvedValue({ data: undefined });
}

describe('StayPrestationsSection', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.delete.mockReset();
  });

  it('1. liste les prestations + total', async () => {
    setupMocks(LINES);
    render(withClient(<StayPrestationsSection stayId="s1" editable />));
    await screen.findByText(/Consultation \(1 × 150\)/);
    await screen.findByText(/Repas \(3 × 40\)/);
    await waitFor(() =>
      expect(screen.getByTestId('stay-prestations-total').textContent).toContain('270'),
    );
  });

  it('2. catalogue listé dans la combobox', async () => {
    setupMocks();
    render(withClient(<StayPrestationsSection stayId="s1" editable />));
    await screen.findByRole('option', { name: /Consultation/ });
    await screen.findByRole('option', { name: /Oxygène/ });
  });

  it('3. sélectionner un acte préremplit label + prix', async () => {
    setupMocks();
    render(withClient(<StayPrestationsSection stayId="s1" editable />));
    await screen.findByRole('option', { name: /Oxygène/ });
    await userEvent.selectOptions(screen.getByLabelText(/Choisir une prestation/i), 'a-o2');
    expect((screen.getByLabelText(/Libellé/i) as HTMLInputElement).value).toBe('Oxygène');
    expect((screen.getByLabelText(/Prix unitaire/i) as HTMLInputElement).value).toBe('80');
  });

  it('4. Ajouter envoie POST { actId, label, unitPrice, quantity }', async () => {
    setupMocks();
    render(withClient(<StayPrestationsSection stayId="s1" editable />));
    await screen.findByRole('option', { name: /Oxygène/ });
    await userEvent.selectOptions(screen.getByLabelText(/Choisir une prestation/i), 'a-o2');
    const qty = screen.getByLabelText(/Quantité/i) as HTMLInputElement;
    fireEvent.change(qty, { target: { value: '2' } });
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    const call = apiMock.post.mock.calls[0]!;
    expect(call[0]).toBe('/hospitalization/stays/s1/prestations');
    expect(call[1]).toMatchObject({ actId: 'a-o2', label: 'Oxygène', unitPrice: 80, quantity: 2 });
  });

  it('5. le bouton × appelle DELETE', async () => {
    setupMocks(LINES);
    render(withClient(<StayPrestationsSection stayId="s1" editable />));
    const del = await screen.findByRole('button', { name: /Retirer Consultation/i });
    await userEvent.click(del);
    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/hospitalization/stays/s1/prestations/l1'));
  });
});
