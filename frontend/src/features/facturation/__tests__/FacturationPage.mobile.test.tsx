import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import FacturationMobilePage from '../FacturationPage.mobile';
import type { InvoiceApi } from '../types';

const INVOICES: InvoiceApi[] = [
  {
    id: 'inv-aaaaaaaa11111111',
    patientId: 'pat-bbbbbbbb22222222',
    consultationId: null,
    status: 'PAYEE_TOTALE',
    number: 'FAC-2026-0001',
    totalAmount: 300,
    discountAmount: 0,
    netAmount: 300,
    lines: [],
    payments: [
      {
        id: 'pay1',
        amount: 300,
        mode: 'ESPECES',
        reference: null,
        paidAt: '2026-04-24T10:00:00Z',
      },
    ],
    mutuelleInsuranceName: null,
    issuedAt: '2026-04-24T09:00:00Z',
    createdAt: '2026-04-24T08:00:00Z',
  },
  {
    id: 'inv-cccccccc33333333',
    patientId: 'pat-dddddddd44444444',
    consultationId: null,
    status: 'EMISE',
    number: 'FAC-2026-0002',
    totalAmount: 200,
    discountAmount: 0,
    netAmount: 200,
    lines: [],
    payments: [],
    mutuelleInsuranceName: null,
    issuedAt: '2026-04-25T09:00:00Z',
    createdAt: '2026-04-25T08:00:00Z',
  },
];

vi.mock('../hooks/useInvoices', () => ({
  useInvoices: () => ({
    invoices: INVOICES,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
  useInvoice: () => ({
    invoice: null,
    isLoading: false,
    error: null,
    refetch: () => Promise.resolve(),
  }),
  useInvoicesForPatient: () => ({ invoices: [], isLoading: false, error: null }),
  useInvoiceByConsultation: () => ({ invoice: null, isLoading: false }),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/facturation', element: <FacturationMobilePage /> }],
    { initialEntries: ['/facturation'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<FacturationMobilePage /> — NRG', () => {
  it('renders the brand topbar and the bottom tabs', () => {
    const { container } = renderPage();
    expect(container.querySelector('.mt-brand-name')).toHaveTextContent('careplus');
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('uses the .m-stat-grid container with two .m-stat tiles', () => {
    const { container } = renderPage();
    const grid = container.querySelector('.m-stat-grid');
    expect(grid).toBeInTheDocument();
    expect(grid!.querySelectorAll('.m-stat')).toHaveLength(2);
    // .m-stat-v should NOT carry an inline fontSize override (regression guard).
    grid!.querySelectorAll<HTMLElement>('.m-stat-v').forEach((el) => {
      expect(el.style.fontSize).toBe('');
    });
  });

  it('renders status pills with .m-pill class (NOT desktop fa-status-pill)', () => {
    const { container } = renderPage();
    expect(container.querySelectorAll('.fa-status-pill')).toHaveLength(0);
    // Two invoices → two status pills using mobile tokens.
    const pills = container.querySelectorAll('.m-pill');
    expect(pills.length).toBeGreaterThanOrEqual(2);
  });

  it('renders filter chips with role=tab (no border-radius:16 pill)', () => {
    const { container } = renderPage();
    const tabs = container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThan(0);
    tabs.forEach((tab) => {
      const radius = (tab as HTMLElement).style.borderRadius;
      // Should be the var(--r-lg) token (or equivalent), never 16px hardcoded.
      expect(radius).not.toBe('16px');
    });
  });

  it('opens the invoice drawer on row tap', () => {
    renderPage();
    fireEvent.click(screen.getByText('FAC-2026-0001').closest('button.m-row')!);
    // InvoiceDrawer renders a dialog when opened.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
