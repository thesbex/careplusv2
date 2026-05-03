/**
 * StockParamTab smoke tests — onglet Stock dans Paramétrage.
 * Run: npm test -- --run features/stock/stock-param
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Suppress known noisy logs ─────────────────────────────────────────────────
const originalError = console.error;
beforeEach(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') || args[0].includes('act('))
    )
      return;
    originalError(...args);
  };
});

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockSuppliers = [
  { id: 'sup-1', name: 'Pharma Maroc', phone: '+212 5 22 00 00 01', active: true },
  { id: 'sup-2', name: 'MedSupply', phone: null, active: false },
];

// ── Mock hooks ────────────────────────────────────────────────────────────────

const useStockSuppliersMock = vi.fn(() => ({
  suppliers: mockSuppliers,
  isLoading: false,
  error: null as string | null,
}));

const upsertMutateAsync = vi.fn().mockResolvedValue({});
const useUpsertSupplierMock = vi.fn((_mode: string) => ({
  mutateAsync: upsertMutateAsync,
  isPending: false,
}));

const deactivateMock = vi.fn().mockResolvedValue(undefined);
const useDeactivateSupplierMock = vi.fn(() => ({
  deactivate: deactivateMock,
  isPending: false,
}));

vi.mock('../hooks/useStockSuppliers', () => ({
  useStockSuppliers: () => useStockSuppliersMock(),
}));

vi.mock('../hooks/useUpsertSupplier', () => ({
  useUpsertSupplier: (mode: string) => useUpsertSupplierMock(mode),
}));

vi.mock('../hooks/useDeactivateSupplier', () => ({
  useDeactivateSupplier: () => useDeactivateSupplierMock(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderTab(ui: ReactNode) {
  const qc = makeQC();
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

import { StockParamTab } from '../components/StockParamTab';

describe('StockParamTab', () => {
  it('renders the "Fournisseurs" section title', () => {
    renderTab(<StockParamTab />);
    expect(screen.getByText('Fournisseurs')).toBeInTheDocument();
  });

  it('renders supplier rows with name and phone', () => {
    renderTab(<StockParamTab />);
    expect(screen.getByText('Pharma Maroc')).toBeInTheDocument();
    expect(screen.getByText('+212 5 22 00 00 01')).toBeInTheDocument();
    expect(screen.getByText('MedSupply')).toBeInTheDocument();
  });

  it('opens drawer when "+ Ajouter fournisseur" is clicked', () => {
    renderTab(<StockParamTab />);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter fournisseur/ }));
    expect(screen.getByRole('dialog', { name: /Ajouter un fournisseur/ })).toBeInTheDocument();
  });

  it('submits form and calls useUpsertSupplier mutateAsync with correct body', async () => {
    upsertMutateAsync.mockResolvedValueOnce({});
    renderTab(<StockParamTab />);

    // Open create drawer
    fireEvent.click(screen.getByRole('button', { name: /Ajouter fournisseur/ }));

    // Fill in form
    const nameInput = screen.getByLabelText(/Nom \*/);
    fireEvent.change(nameInput, { target: { value: 'Nouveau Fournisseur' } });

    const phoneInput = screen.getByLabelText(/Téléphone/);
    fireEvent.change(phoneInput, { target: { value: '+212 6 00 00 00 00' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Ajouter$/ }));

    await waitFor(() => {
      expect(upsertMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            name: 'Nouveau Fournisseur',
            phone: '+212 6 00 00 00 00',
            active: true,
          }),
        }),
      );
    });
  });

  it('shows confirm dialog and calls deactivate when "Désactiver" is clicked', async () => {
    deactivateMock.mockResolvedValueOnce(undefined);
    renderTab(<StockParamTab />);

    // Click the deactivate button for the first (active) supplier
    fireEvent.click(screen.getByRole('button', { name: /Désactiver Pharma Maroc/ }));

    // Confirm dialog should appear
    expect(screen.getByRole('dialog', { name: /Confirmer la désactivation/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Pharma Maroc/).length).toBeGreaterThanOrEqual(1);

    // Confirm
    fireEvent.click(screen.getByRole('button', { name: /^Désactiver$/ }));

    await waitFor(() => {
      expect(deactivateMock).toHaveBeenCalledWith('sup-1');
    });
  });

  it('has no a11y violations', async () => {
    const { container } = renderTab(<StockParamTab />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
