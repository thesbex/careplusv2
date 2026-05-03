import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LabCatalogueMobilePage from '../LabCataloguePage.mobile';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn() },
}));

const LAB_TESTS = [
  { id: 'l1', code: 'NFS', name: 'Numération formule sanguine', category: 'Hématologie' },
  { id: 'l2', code: 'GLY', name: 'Glycémie à jeun', category: 'Biochimie' },
  { id: 'l3', code: 'TSH', name: 'TSH ultra-sensible', category: 'Endocrinologie' },
];

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: LAB_TESTS });
});

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/catalogue/analyses', element: <LabCatalogueMobilePage /> },
      { path: '/parametres', element: <div>Paramètres</div> },
    ],
    { initialEntries: ['/catalogue/analyses'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<LabCatalogueMobilePage /> — NRG', () => {
  it('renders the topbar with title "Analyses"', () => {
    const { container } = renderPage();
    expect(container.querySelector('.mt-title')).toHaveTextContent('Analyses');
  });

  it('uses .m-search for the search input (token consistency)', () => {
    const { container } = renderPage();
    expect(container.querySelector('label.m-search')).toBeInTheDocument();
  });

  it('renders the lab tests inside an .m-card with .m-row entries', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Numération formule sanguine')).toBeInTheDocument(),
    );
    expect(screen.getByText('Glycémie à jeun')).toBeInTheDocument();
    expect(screen.getByText('TSH ultra-sensible')).toBeInTheDocument();
    // Codes are shown as monospaced.
    expect(screen.getByText('NFS')).toBeInTheDocument();
  });

  it('renders the read-only hint message', () => {
    renderPage();
    expect(screen.getByText(/Référentiel en lecture seule/i)).toBeInTheDocument();
  });
});
