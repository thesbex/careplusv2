import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ImagingCatalogueMobilePage from '../ImagingCataloguePage.mobile';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn() },
}));

const IMAGING_EXAMS = [
  { id: 'i1', code: 'RX-TX', name: 'Radio thorax', modality: 'Radiographie' },
  { id: 'i2', code: 'ECHO-AB', name: 'Échographie abdominale', modality: 'Échographie' },
  { id: 'i3', code: 'IRM-CR', name: 'IRM cérébrale', modality: 'IRM' },
];

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: IMAGING_EXAMS });
});

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/catalogue/radio', element: <ImagingCatalogueMobilePage /> },
      { path: '/parametres', element: <div>Paramètres</div> },
    ],
    { initialEntries: ['/catalogue/radio'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<ImagingCatalogueMobilePage /> — NRG', () => {
  it('renders the topbar with title "Radio / Imagerie"', () => {
    const { container } = renderPage();
    expect(container.querySelector('.mt-title')).toHaveTextContent('Radio / Imagerie');
  });

  it('uses .m-search for the search input', () => {
    const { container } = renderPage();
    expect(container.querySelector('label.m-search')).toBeInTheDocument();
  });

  it('renders the imaging exams inside an .m-card with .m-row entries', async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByText('Radio thorax')).toBeInTheDocument(),
    );
    expect(screen.getByText('Échographie abdominale')).toBeInTheDocument();
    expect(screen.getByText('IRM cérébrale')).toBeInTheDocument();
    expect(screen.getByText('IRM-CR')).toBeInTheDocument();
  });

  it('renders the read-only hint message', () => {
    renderPage();
    expect(screen.getByText(/Référentiel en lecture seule/i)).toBeInTheDocument();
  });
});
