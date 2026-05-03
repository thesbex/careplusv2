/**
 * Stock pages smoke tests — StockArticlesPage + StockArticleDetailPage.
 * Run: npm test -- --run features/stock/stock-pages
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

// ── Mock shell components ────────────────────────────────────────────────────

vi.mock('@/components/shell/Screen', () => ({
  Screen: ({
    children,
    title,
    topbarRight,
  }: {
    children: ReactNode;
    title: string;
    active?: string;
    sub?: string;
    onNavigate?: unknown;
    topbarRight?: ReactNode;
  }) => (
    <div data-testid="screen">
      <div data-testid="screen-title">{title}</div>
      {topbarRight && <div data-testid="screen-topbar-right">{topbarRight}</div>}
      {children}
    </div>
  ),
}));

vi.mock('@/components/shell/MScreen', () => ({
  MScreen: ({ children, topbar }: { children: ReactNode; topbar?: ReactNode }) => (
    <div data-testid="mscreen">
      {topbar}
      {children}
    </div>
  ),
}));

vi.mock('@/components/shell/MTopbar', () => ({
  MTopbar: ({
    title,
    sub,
  }: {
    title?: string;
    sub?: string;
    left?: ReactNode;
    right?: ReactNode;
  }) => (
    <div data-testid="mtopbar">
      <span>{title}</span>
      {sub && <span>{sub}</span>}
    </div>
  ),
}));

// ── Mock auth ────────────────────────────────────────────────────────────────

vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(
    (selector: (s: { user: { roles: string[]; permissions: string[] } | null }) => unknown) =>
      selector({ user: { roles: ['MEDECIN'], permissions: [] } }),
  ),
}));

// ── Mock hooks ────────────────────────────────────────────────────────────────

const mockArticles = [
  {
    id: 'art-1',
    code: 'BETADINE-125',
    label: 'Bétadine 10% 125mL',
    category: 'MEDICAMENT_INTERNE' as const,
    unit: 'flacon',
    minThreshold: 5,
    supplierId: 'sup-1',
    supplierName: 'Pharma Maroc',
    location: 'Armoire 1',
    active: true,
    tracksLots: true,
    currentQuantity: 3,
    nearestExpiry: null,
  },
  {
    id: 'art-2',
    code: 'GANT-NITRILE-M',
    label: 'Gants nitrile taille M',
    category: 'CONSOMMABLE' as const,
    unit: 'boîte',
    minThreshold: 2,
    supplierId: null,
    supplierName: null,
    location: null,
    active: true,
    tracksLots: false,
    currentQuantity: 10,
    nearestExpiry: null,
  },
];

const mockArticleDetail = {
  ...mockArticles[0]!,
  currentQuantity: 3,
};

const mockLots = [
  {
    id: 'lot-1',
    articleId: 'art-1',
    lotNumber: 'L2024-001',
    expiresOn: '2027-06-01',
    quantity: 3,
    status: 'ACTIVE' as const,
  },
];

const mockMovements = [
  {
    id: 'mov-1',
    articleId: 'art-1',
    lotId: 'lot-1',
    lotNumber: 'L2024-001',
    type: 'IN' as const,
    quantity: 10,
    reason: null,
    performedBy: { id: 'u-1', name: 'Dr Amrani' },
    performedAt: '2024-05-01T10:00:00Z',
  },
];

const mockSuppliers = [{ id: 'sup-1', name: 'Pharma Maroc', phone: null, active: true }];

// Mock hook implementations
const useStockArticlesMock = vi.fn((_filters?: unknown) => ({
  articles: mockArticles,
  totalElements: 2,
  totalPages: 1,
  currentPage: 0,
  isLoading: false,
  error: null as string | null,
  page: null,
}));

const useStockArticleMock = vi.fn((_id?: string) => ({
  article: mockArticleDetail,
  isLoading: false,
  error: null as string | null,
}));

const useStockLotsMock = vi.fn((_id?: string, _status?: string) => ({
  lots: mockLots,
  isLoading: false,
  error: null as string | null,
}));

const useStockMovementsMock = vi.fn((_id?: string, _filters?: unknown) => ({
  movements: mockMovements,
  totalElements: 1,
  totalPages: 1,
  currentPage: 0,
  isLoading: false,
  error: null as string | null,
  page: null,
}));

const useStockSuppliersMock = vi.fn(() => ({
  suppliers: mockSuppliers,
  isLoading: false,
  error: null as string | null,
}));

vi.mock('../hooks/useStockArticles', () => ({
  useStockArticles: (filters?: unknown) => useStockArticlesMock(filters),
}));

vi.mock('../hooks/useStockArticle', () => ({
  useStockArticle: (id?: string) => useStockArticleMock(id),
}));

vi.mock('../hooks/useStockLots', () => ({
  useStockLots: (id?: string, status?: string) => useStockLotsMock(id, status),
}));

vi.mock('../hooks/useStockMovements', () => ({
  useStockMovements: (id?: string, filters?: unknown) => useStockMovementsMock(id, filters),
}));

vi.mock('../hooks/useStockSuppliers', () => ({
  useStockSuppliers: () => useStockSuppliersMock(),
}));

vi.mock('../hooks/useUpsertArticle', () => ({
  useUpsertArticle: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

vi.mock('../hooks/useRecordMovement', () => ({
  useRecordMovement: () => ({ mutateAsync: vi.fn().mockResolvedValue({}), isPending: false }),
}));

vi.mock('../hooks/useInactivateLot', () => ({
  useInactivateLot: () => ({ inactivate: vi.fn().mockResolvedValue({}), isPending: false }),
}));

vi.mock('../hooks/useStockAlertsCount', () => ({
  useStockAlertsCount: () => 2,
}));

vi.mock('vaul', () => ({
  Drawer: {
    Root: ({ children, open }: { children: ReactNode; open?: boolean }) =>
      open ? <div data-testid="vaul-root">{children}</div> : null,
    Portal: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    Overlay: () => <div />,
    Content: ({ children, 'aria-label': label }: { children: ReactNode; 'aria-label'?: string }) => (
      <div role="dialog" aria-label={label ?? 'drawer'}>
        {children}
      </div>
    ),
    Trigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithAll(ui: ReactNode, initialPath = '/stock') {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function renderWithRoute(path: string, routes: ReactNode) {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        {routes}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── StockArticlesPage (desktop) ────────────────────────────────────────────────

import StockArticlesPage from '../StockArticlesPage';

describe('StockArticlesPage (desktop)', () => {
  it('renders the page title', () => {
    renderWithAll(<StockArticlesPage />);
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Stock interne');
  });

  it('renders article table with article data', () => {
    renderWithAll(<StockArticlesPage />);
    expect(screen.getByText('Bétadine 10% 125mL')).toBeInTheDocument();
    expect(screen.getByText('Gants nitrile taille M')).toBeInTheDocument();
  });

  it('renders category pills', () => {
    renderWithAll(<StockArticlesPage />);
    // Multiple instances expected: filter chip + table pill for each category
    expect(screen.getAllByText('Médicament').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Consommable').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the "Ajouter article" button for MEDECIN', () => {
    renderWithAll(<StockArticlesPage />);
    expect(screen.getByRole('button', { name: /Ajouter article/ })).toBeInTheDocument();
  });

  it('renders filter chips for all 3 categories', () => {
    renderWithAll(<StockArticlesPage />);
    expect(screen.getByRole('button', { name: /Médicament/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dossier physique/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Consommable/ })).toBeInTheDocument();
  });

  it('renders supplier filter with supplier name', () => {
    renderWithAll(<StockArticlesPage />);
    // Supplier appears in both the filter dropdown and the article table
    expect(screen.getAllByText('Pharma Maroc').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Voir" and edit buttons for each article', () => {
    renderWithAll(<StockArticlesPage />);
    const voirButtons = screen.getAllByRole('button', { name: /Voir/ });
    expect(voirButtons.length).toBe(2);
  });

  it('shows empty state when no articles', () => {
    useStockArticlesMock.mockReturnValueOnce({
      articles: [],
      totalElements: 0,
      totalPages: 0,
      currentPage: 0,
      isLoading: false,
      error: null,
      page: null,
    });
    renderWithAll(<StockArticlesPage />);
    expect(screen.getByText('Aucun article trouvé')).toBeInTheDocument();
  });

  it('shows error state when API fails', () => {
    useStockArticlesMock.mockReturnValueOnce({
      articles: [],
      totalElements: 0,
      totalPages: 0,
      currentPage: 0,
      isLoading: false,
      error: 'Impossible de charger les articles.',
      page: null,
    });
    renderWithAll(<StockArticlesPage />);
    expect(screen.getByText(/Impossible de charger les articles/)).toBeInTheDocument();
  });

  it('opens form drawer when "Ajouter article" is clicked', () => {
    renderWithAll(<StockArticlesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Ajouter article/ }));
    // The drawer renders with the label "Ajouter un article"
    expect(screen.getByRole('dialog', { name: /Ajouter un article/ })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithAll(<StockArticlesPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── StockArticlesPage (mobile) ──────────────────────────────────────────────────

import StockArticlesPageMobile from '../StockArticlesPage.mobile';

describe('StockArticlesPage (mobile)', () => {
  it('renders the topbar with correct title', () => {
    renderWithAll(<StockArticlesPageMobile />);
    expect(screen.getByTestId('mtopbar')).toHaveTextContent('Stock interne');
  });

  it('renders article cards for each article', () => {
    renderWithAll(<StockArticlesPageMobile />);
    expect(screen.getByText('Bétadine 10% 125mL')).toBeInTheDocument();
    expect(screen.getByText('Gants nitrile taille M')).toBeInTheDocument();
  });

  it('renders category chips', () => {
    renderWithAll(<StockArticlesPageMobile />);
    expect(screen.getAllByText('Médicament').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Consommable').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Voir la fiche" buttons', () => {
    renderWithAll(<StockArticlesPageMobile />);
    const voirButtons = screen.getAllByText('Voir la fiche');
    expect(voirButtons.length).toBe(2);
  });

  it('shows empty state when no articles', () => {
    useStockArticlesMock.mockReturnValueOnce({
      articles: [],
      totalElements: 0,
      totalPages: 0,
      currentPage: 0,
      isLoading: false,
      error: null,
      page: null,
    });
    renderWithAll(<StockArticlesPageMobile />);
    expect(screen.getByText('Aucun article trouvé')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithAll(<StockArticlesPageMobile />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── StockArticleDetailPage (desktop) ──────────────────────────────────────────

import StockArticleDetailPage from '../StockArticleDetailPage';

describe('StockArticleDetailPage (desktop)', () => {
  function renderDetail() {
    return renderWithRoute(
      '/stock/articles/art-1',
      <Routes>
        <Route path="/stock/articles/:id" element={<StockArticleDetailPage />} />
      </Routes>,
    );
  }

  it('renders the page title', () => {
    renderDetail();
    expect(screen.getByTestId('screen-title')).toHaveTextContent('Stock interne');
  });

  it('renders the article code and label', () => {
    renderDetail();
    expect(screen.getByText('BETADINE-125')).toBeInTheDocument();
    expect(screen.getByText('Bétadine 10% 125mL')).toBeInTheDocument();
  });

  it('renders the current quantity prominently', () => {
    renderDetail();
    // Quantity = 3 should appear in the header (possibly multiple times)
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the 3 quick action buttons', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /\+ Entrée/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /− Sortie/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajuster/ })).toBeInTheDocument();
  });

  it('renders the lots section for medicaments', () => {
    renderDetail();
    expect(screen.getAllByText(/Lots actifs/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('L2024-001').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the movement history section', () => {
    renderDetail();
    expect(screen.getAllByText(/Historique/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Entrée').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the "Inactiver" button on active lots for MEDECIN', () => {
    renderDetail();
    expect(screen.getByRole('button', { name: /Inactiver/ })).toBeInTheDocument();
  });

  it('opens movement drawer when "+ Entrée" is clicked', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /\+ Entrée/ }));
    expect(screen.getByRole('dialog', { name: /Entrée de stock/ })).toBeInTheDocument();
  });

  it('opens movement drawer when "− Sortie" is clicked', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /− Sortie/ }));
    expect(screen.getByRole('dialog', { name: /Sortie de stock/ })).toBeInTheDocument();
  });

  it('opens movement drawer when "Ajuster" is clicked', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /Ajuster/ }));
    expect(screen.getByRole('dialog', { name: /Ajustement de stock/ })).toBeInTheDocument();
  });

  it('opens lot inactivate dialog when "Inactiver" is clicked', () => {
    renderDetail();
    fireEvent.click(screen.getByRole('button', { name: /Inactiver/ }));
    expect(screen.getByText(/Inactiver le lot/)).toBeInTheDocument();
  });

  it('renders error state when article not found', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (useStockArticleMock as any).mockReturnValueOnce({
      article: null,
      isLoading: false,
      error: 'Article introuvable.',
    });
    renderDetail();
    expect(screen.getByText('Article introuvable.')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderDetail();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── StockArticleDetailPage (mobile) ──────────────────────────────────────────

import StockArticleDetailPageMobile from '../StockArticleDetailPage.mobile';

describe('StockArticleDetailPage (mobile)', () => {
  function renderDetailMobile() {
    return renderWithRoute(
      '/stock/articles/art-1',
      <Routes>
        <Route path="/stock/articles/:id" element={<StockArticleDetailPageMobile />} />
      </Routes>,
    );
  }

  it('renders the topbar with article label', () => {
    renderDetailMobile();
    expect(screen.getByTestId('mtopbar')).toHaveTextContent('Bétadine 10% 125mL');
  });

  it('renders the 3 quick action buttons full-width', () => {
    renderDetailMobile();
    expect(screen.getByRole('button', { name: /\+ Entrée de stock/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /− Sortie de stock/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ajuster le stock/ })).toBeInTheDocument();
  });

  it('renders collapsible lots section', () => {
    renderDetailMobile();
    expect(screen.getByText(/Lots actifs/)).toBeInTheDocument();
  });

  it('renders collapsible history section', () => {
    renderDetailMobile();
    expect(screen.getByText(/Historique/)).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderDetailMobile();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
