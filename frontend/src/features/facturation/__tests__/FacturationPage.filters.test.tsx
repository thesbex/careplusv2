import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import FacturationPage from '../FacturationPage';
import { useAuthStore } from '@/lib/auth/authStore';
import type { InvoiceListRow } from '../types';

const ROWS: InvoiceListRow[] = [
  {
    id: 'inv-1',
    number: '2026-000001',
    status: 'EMISE',
    patientId: 'pat-1',
    patientFullName: 'Alami Hassan',
    patientPhone: '0612345678',
    mutuelleName: null,
    totalAmount: 300,
    discountAmount: 0,
    netAmount: 300,
    paidAmount: 0,
    paymentModes: [],
    issuedAt: '2026-04-15T09:00:00Z',
    lastPaymentAt: null,
    createdAt: '2026-04-15T08:00:00Z',
  },
];

const useInvoiceSearchMock = vi.fn(() => ({
  response: null,
  items: ROWS,
  totalCount: ROWS.length,
  totalNet: 300,
  totalPaid: 0,
  totalRemaining: 300,
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
}));

vi.mock('../hooks/useInvoiceSearch', () => ({
  useInvoiceSearch: (...args: unknown[]) => useInvoiceSearchMock(...(args as [])),
  filtersToParams: () => ({}),
}));

vi.mock('../hooks/useInvoices', () => ({
  useInvoice: () => ({ invoice: null, isLoading: false, error: null, refetch: () => Promise.resolve() }),
  useInvoices: () => ({ invoices: [], isLoading: false, error: null, refetch: () => Promise.resolve() }),
  useInvoicesForPatient: () => ({ invoices: [], isLoading: false, error: null }),
  useInvoiceByConsultation: () => ({ invoice: null, isLoading: false }),
}));

vi.mock('../../caisse/hooks/useCaisseToday', () => ({
  useCaisseToday: () => ({ caisse: null, isLoading: false, error: null }),
}));

vi.mock('../../prise-rdv/hooks/usePatientSearch', () => ({
  usePatientSearch: () => ({ candidates: [], isLoading: false, error: null }),
}));

const exportInvoicesMock = vi.fn();
const useInvoiceExportState = { isExporting: false, error: null as string | null };
vi.mock('../hooks/useInvoiceExport', () => ({
  useInvoiceExport: () => ({
    exportInvoices: exportInvoicesMock,
    isExporting: useInvoiceExportState.isExporting,
    error: useInvoiceExportState.error,
    clearError: () => { useInvoiceExportState.error = null; },
  }),
}));

function renderWithRole(role: 'MEDECIN' | 'SECRETAIRE', initialUrl = '/facturation') {
  useAuthStore.setState({
    accessToken: 'tok',
    user: { id: 'u1', email: 'u@test', firstName: 'X', lastName: 'Y', roles: [role], permissions: [] },
  });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/facturation', element: <FacturationPage /> }],
    { initialEntries: [initialUrl] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useInvoiceSearchMock.mockClear();
  exportInvoicesMock.mockClear();
  useInvoiceExportState.isExporting = false;
  useInvoiceExportState.error = null;
});

describe('<FacturationPage /> — advanced filters + export', () => {
  it('opens the advanced filters popover on click', () => {
    renderWithRole('MEDECIN');
    const trigger = screen.getByRole('button', { name: /Filtres avancés/i });
    fireEvent.click(trigger);
    expect(screen.getByLabelText('Filtres avancés')).toBeInTheDocument();
    expect(screen.getByText('Date à appliquer')).toBeInTheDocument();
    expect(screen.getByText('Modes de paiement')).toBeInTheDocument();
  });

  it('preset "Ce mois" fills the date pickers', () => {
    renderWithRole('MEDECIN');
    fireEvent.click(screen.getByRole('button', { name: /Filtres avancés/i }));
    const today = new Date();
    const expectedFrom = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString().slice(0, 10);
    fireEvent.click(screen.getByRole('button', { name: 'Ce mois' }));
    const fromInput = screen.getByLabelText(/Du/i) as HTMLInputElement;
    expect(fromInput.value).toBe(expectedFrom);
  });

  it('Appliquer triggers a refetch with the selected filters', () => {
    renderWithRole('MEDECIN');
    useInvoiceSearchMock.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Filtres avancés/i }));
    // Toggle CB checkbox
    const cb = screen.getByLabelText('Carte bancaire') as HTMLInputElement;
    fireEvent.click(cb);
    fireEvent.click(screen.getByRole('button', { name: 'Appliquer' }));
    expect(useInvoiceSearchMock).toHaveBeenCalled();
    const lastCall = (useInvoiceSearchMock.mock.calls.at(-1) as unknown[])[0] as { paymentModes: string[] };
    expect(lastCall.paymentModes).toContain('CB');
  });

  it('shows a (N) badge when N filters are active', () => {
    renderWithRole('MEDECIN', '/facturation?from=2026-04-01&to=2026-04-30&paymentMode=CB');
    expect(screen.getByRole('button', { name: /Filtres avancés \(2\)/i })).toBeInTheDocument();
  });

  it('syncs filter state with URL search params', async () => {
    renderWithRole('MEDECIN', '/facturation?status=EMISE&from=2026-04-01');
    // The chip "Émises" should be selected (single-status filter)
    const emiseChip = screen.getByRole('tab', { name: 'Émises' });
    expect(emiseChip.getAttribute('aria-selected')).toBe('true');
    // The hook receives the parsed filters
    await waitFor(() => {
      const last = (useInvoiceSearchMock.mock.calls.at(-1) as unknown[])[0] as { from: string | null; statuses: string[] };
      expect(last.from).toBe('2026-04-01');
      expect(last.statuses).toEqual(['EMISE']);
    });
  });

  it('hides the export button for SECRETAIRE role', () => {
    renderWithRole('SECRETAIRE');
    expect(screen.queryByRole('button', { name: /^Exporter$/i })).not.toBeInTheDocument();
  });

  it('shows the export button for MEDECIN and triggers CSV export on click', () => {
    renderWithRole('MEDECIN');
    const exportBtn = screen.getByRole('button', { name: /^Exporter$/i });
    fireEvent.click(exportBtn);
    expect(exportInvoicesMock).toHaveBeenCalledWith(expect.any(Object), 'csv');
  });

  it('xlsx menu item triggers xlsx export', () => {
    renderWithRole('MEDECIN');
    const caret = screen.getByRole('button', { name: /Choisir le format/i });
    fireEvent.click(caret);
    fireEvent.click(screen.getByRole('menuitem', { name: /Exporter en Excel/i }));
    expect(exportInvoicesMock).toHaveBeenCalledWith(expect.any(Object), 'xlsx');
  });

  it('displays an error toast when export hook reports a 422', () => {
    useInvoiceExportState.error = "Trop de résultats à exporter. Affinez vos filtres (max 10 000 factures).";
    renderWithRole('MEDECIN');
    expect(screen.getByRole('alert')).toHaveTextContent(/Trop de résultats/i);
  });
});
