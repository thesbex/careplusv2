import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import CatalogueMobilePage from '../CataloguePage.mobile';
import { api } from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn(),
  },
}));

const MEDS = [
  {
    id: 'm1',
    commercialName: 'Doliprane',
    dci: 'Paracétamol',
    form: 'comprimé',
    dosage: '500mg',
    tags: 'antalgique',
    favorite: true,
    active: true,
  },
  {
    id: 'm2',
    commercialName: 'Aspégic',
    dci: 'Acide acétylsalicylique',
    form: 'sachet',
    dosage: '1000mg',
    tags: 'ains',
    favorite: false,
    active: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/catalog/medications/tags') {
      return Promise.resolve({ data: ['antalgique', 'ains'] });
    }
    if (url === '/catalog/medications/browse') {
      return Promise.resolve({ data: MEDS });
    }
    return Promise.resolve({ data: [] });
  });
});

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/catalogue', element: <CatalogueMobilePage /> },
      { path: '/parametres', element: <div>Paramètres</div> },
    ],
    { initialEntries: ['/catalogue'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<CatalogueMobilePage /> — NRG', () => {
  it('uses .m-search for the search input (token consistency)', async () => {
    const { container } = renderPage();
    expect(container.querySelector('label.m-search')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Rechercher un médicament')).toBeInTheDocument(),
    );
  });

  it('renders medication rows with the favorite pill (no ★ unicode)', async () => {
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText('Doliprane')).toBeInTheDocument());
    expect(screen.getByText('Aspégic')).toBeInTheDocument();
    // Favorite badge is a text pill, not the ★ character.
    const favorite = screen.getByLabelText('Médicament favori');
    expect(favorite).toHaveTextContent('Favori');
    // No raw ★ glyph anywhere in the rendered tree.
    expect(container.textContent).not.toContain('★');
  });

  it('renders rows inside an .m-card without inline borderTop overrides', async () => {
    const { container } = renderPage();
    await waitFor(() => expect(screen.getByText('Doliprane')).toBeInTheDocument());
    const rows = container.querySelectorAll('.m-card > .m-row');
    expect(rows.length).toBe(2);
    // The mobile.css `.m-row + .m-row` adjacent selector handles dividers — no
    // inline borderTop should be set on rows.
    rows.forEach((row) => {
      expect((row as HTMLElement).style.borderTop).toBe('');
    });
  });
});
