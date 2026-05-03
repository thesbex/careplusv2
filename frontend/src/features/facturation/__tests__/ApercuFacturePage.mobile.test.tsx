import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ApercuFactureMobilePage from '../ApercuFacturePage.mobile';
import type { InvoiceApi } from '../types';

const INVOICE: InvoiceApi = {
  id: 'inv-1',
  patientId: 'pat-1',
  consultationId: null,
  status: 'PAYEE_TOTALE',
  number: 'FAC-2026-00482',
  totalAmount: 300,
  discountAmount: 0,
  netAmount: 300,
  lines: [
    { id: 'l1', description: 'Consultation généraliste', quantity: 1, unitPrice: 300, totalPrice: 300 },
  ],
  payments: [
    { id: 'p1', amount: 300, mode: 'ESPECES', reference: null, paidAt: '2026-04-24T10:00:00Z' },
  ],
  mutuelleInsuranceName: null,
  issuedAt: '2026-04-24T09:00:00Z',
  createdAt: '2026-04-24T08:00:00Z',
};

vi.mock('../hooks/useInvoices', () => ({
  useInvoice: () => ({ invoice: INVOICE, isLoading: false, error: null, refetch: () => Promise.resolve() }),
  useInvoices: () => ({ invoices: [], isLoading: false, error: null, refetch: () => Promise.resolve() }),
  useInvoicesForPatient: () => ({ invoices: [], isLoading: false, error: null }),
  useInvoiceByConsultation: () => ({ invoice: null, isLoading: false }),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/facturation/:id/apercu', element: <ApercuFactureMobilePage /> },
      { path: '/facturation', element: <div>Facturation</div> },
    ],
    { initialEntries: ['/facturation/inv-1/apercu'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<ApercuFactureMobilePage /> — NRG', () => {
  it('renders invoice number as topbar TITLE, not as sub', () => {
    const { container } = renderPage();
    const title = container.querySelector('.mt-title');
    const sub = container.querySelector('.mt-sub');
    expect(title).toHaveTextContent('FAC-2026-00482');
    expect(sub).toHaveTextContent('Aperçu');
  });

  it('renders an invoice line and the total', () => {
    renderPage();
    expect(screen.getByText('Consultation généraliste')).toBeInTheDocument();
    expect(screen.getByText('Net à payer')).toBeInTheDocument();
  });

  it('renders the print button (mobile-friendly action)', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Imprimer/i })).toBeInTheDocument();
  });

  it('uses no hardcoded #2E7D32 (uses var(--success) instead)', () => {
    const { container } = renderPage();
    container.querySelectorAll<HTMLElement>('[style*="color"]').forEach((el) => {
      expect(el.style.color.toLowerCase()).not.toBe('#2e7d32');
      expect(el.style.color.toLowerCase()).not.toBe('rgb(46, 125, 50)');
    });
  });
});
