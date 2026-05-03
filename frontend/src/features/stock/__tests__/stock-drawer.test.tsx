/**
 * Stock drawer tests — MovementDrawer (3 modes) + StockArticleFormDrawer + LotInactivateDialog.
 * Run: npm test -- --run features/stock/stock-drawer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// ── Suppress noisy logs ───────────────────────────────────────────────────────
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

// ── Mock hooks used in drawers ────────────────────────────────────────────────

const recordMovementMock = vi.fn().mockResolvedValue({});
const upsertArticleMock = vi.fn().mockResolvedValue({});
const inactivateLotMock = vi.fn().mockResolvedValue({});

vi.mock('../hooks/useRecordMovement', () => ({
  useRecordMovement: () => ({
    mutateAsync: recordMovementMock,
    isPending: false,
  }),
}));

vi.mock('../hooks/useStockLots', () => ({
  useStockLots: () => ({
    lots: [
      {
        id: 'lot-1',
        articleId: 'art-1',
        lotNumber: 'L2024-001',
        expiresOn: '2027-06-01',
        quantity: 5,
        status: 'ACTIVE' as const,
      },
    ],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useUpsertArticle', () => ({
  useUpsertArticle: (mode: string) => ({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    mutateAsync: (args: unknown) => upsertArticleMock(mode, args),
    isPending: false,
  }),
}));

vi.mock('../hooks/useStockSuppliers', () => ({
  useStockSuppliers: () => ({
    suppliers: [{ id: 'sup-1', name: 'Pharma Maroc', phone: null, active: true }],
    isLoading: false,
    error: null,
  }),
}));

vi.mock('../hooks/useInactivateLot', () => ({
  useInactivateLot: () => ({
    inactivate: inactivateLotMock,
    isPending: false,
  }),
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

function renderWithAll(ui: ReactNode) {
  const qc = makeQC();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// ── MovementDrawer — IN mode (consommable) ────────────────────────────────────

import { MovementDrawer } from '../components/MovementDrawer';

const BASE_DRAWER_PROPS = {
  articleId: 'art-1',
  articleLabel: 'Gants nitrile M',
  currentQuantity: 10,
  onClose: vi.fn(),
};

describe('MovementDrawer — IN mode (consommable)', () => {
  it('renders with title "Entrée de stock"', () => {
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="CONSOMMABLE"
        mode="IN"
        open={true}
      />,
    );
    expect(screen.getByRole('dialog', { name: /Entrée de stock/ })).toBeInTheDocument();
  });

  it('shows quantity field', () => {
    renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="IN" open={true} />,
    );
    expect(screen.getByLabelText(/Quantité/)).toBeInTheDocument();
  });

  it('does NOT show lot/expiry fields for consommable', () => {
    renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="IN" open={true} />,
    );
    expect(screen.queryByLabelText(/Numéro de lot/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Date de péremption/)).not.toBeInTheDocument();
  });

  it('renders nothing when open=false', () => {
    const { container } = renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="IN" open={false} />,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });
});

// ── MovementDrawer — IN mode (medicament) ────────────────────────────────────

describe('MovementDrawer — IN mode (medicament)', () => {
  it('shows lot number and expiry date fields', () => {
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="MEDICAMENT_INTERNE"
        mode="IN"
        open={true}
      />,
    );
    expect(screen.getByLabelText(/Numéro de lot/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date de péremption/)).toBeInTheDocument();
  });

  it('shows existing lots in datalist', () => {
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="MEDICAMENT_INTERNE"
        mode="IN"
        open={true}
      />,
    );
    const datalist = document.getElementById('mv-lot-list');
    expect(datalist).toBeInTheDocument();
  });

  it('calls useRecordMovement with correct body on submit', async () => {
    recordMovementMock.mockResolvedValueOnce({});
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="MEDICAMENT_INTERNE"
        mode="IN"
        open={true}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Numéro de lot/), {
      target: { value: 'L2025-NEW' },
    });
    fireEvent.change(screen.getByLabelText(/Date de péremption/), {
      target: { value: '2027-12-31' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Entrée de stock/ }));

    await waitFor(() => {
      expect(recordMovementMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'IN',
          quantity: 5,
          lotNumber: 'L2025-NEW',
          expiresOn: '2027-12-31',
        }),
      );
    });
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="MEDICAMENT_INTERNE"
        mode="IN"
        open={true}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── MovementDrawer — OUT mode ─────────────────────────────────────────────────

describe('MovementDrawer — OUT mode', () => {
  it('renders with title "Sortie de stock"', () => {
    renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="OUT" open={true} />,
    );
    expect(screen.getByRole('dialog', { name: /Sortie de stock/ })).toBeInTheDocument();
  });

  it('shows current stock info', () => {
    renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="OUT" open={true} />,
    );
    expect(screen.getByText(/Stock disponible/)).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('shows warning when quantity exceeds current stock', async () => {
    renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="OUT" open={true} />,
    );
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '15' } });
    await waitFor(() => {
      expect(screen.getByText(/Attention.*stock disponible/)).toBeInTheDocument();
    });
  });

  it('does NOT show lot/expiry or reason fields for OUT', () => {
    renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="OUT" open={true} />,
    );
    expect(screen.queryByLabelText(/Numéro de lot/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Motif/)).not.toBeInTheDocument();
  });

  it('calls useRecordMovement with type=OUT on submit', async () => {
    recordMovementMock.mockResolvedValueOnce({});
    renderWithAll(
      <MovementDrawer {...BASE_DRAWER_PROPS} articleCategory="CONSOMMABLE" mode="OUT" open={true} />,
    );
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /Sortie de stock/ }));

    await waitFor(() => {
      expect(recordMovementMock).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'OUT', quantity: 3 }),
      );
    });
  });
});

// ── MovementDrawer — ADJUSTMENT mode ─────────────────────────────────────────

describe('MovementDrawer — ADJUSTMENT mode', () => {
  it('renders with title "Ajustement de stock"', () => {
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="CONSOMMABLE"
        mode="ADJUSTMENT"
        open={true}
      />,
    );
    expect(screen.getByRole('dialog', { name: /Ajustement de stock/ })).toBeInTheDocument();
  });

  it('shows reason textarea', () => {
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="CONSOMMABLE"
        mode="ADJUSTMENT"
        open={true}
      />,
    );
    expect(screen.getByLabelText(/Motif/)).toBeInTheDocument();
  });

  it('shows validation error when reason is missing', async () => {
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="CONSOMMABLE"
        mode="ADJUSTMENT"
        open={true}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /Ajustement de stock/ }));

    await waitFor(() => {
      expect(screen.getByText(/Motif obligatoire/)).toBeInTheDocument();
    });
  });

  it('calls useRecordMovement with type=ADJUSTMENT and reason on submit', async () => {
    recordMovementMock.mockResolvedValueOnce({});
    renderWithAll(
      <MovementDrawer
        {...BASE_DRAWER_PROPS}
        articleCategory="CONSOMMABLE"
        mode="ADJUSTMENT"
        open={true}
      />,
    );
    fireEvent.change(screen.getByLabelText(/Quantité/), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText(/Motif/), { target: { value: 'Inventaire juin' } });
    fireEvent.click(screen.getByRole('button', { name: /Ajustement de stock/ }));

    await waitFor(() => {
      expect(recordMovementMock).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADJUSTMENT',
          quantity: 8,
          reason: 'Inventaire juin',
        }),
      );
    });
  });
});

// ── StockArticleFormDrawer ────────────────────────────────────────────────────

import { StockArticleFormDrawer } from '../components/StockArticleFormDrawer';

describe('StockArticleFormDrawer — create mode', () => {
  it('renders with title "Ajouter un article"', () => {
    renderWithAll(
      <StockArticleFormDrawer mode="create" open={true} onClose={vi.fn()} />,
    );
    expect(screen.getByRole('dialog', { name: /Ajouter un article/ })).toBeInTheDocument();
  });

  it('shows code, label, category, unit, threshold fields', () => {
    renderWithAll(
      <StockArticleFormDrawer mode="create" open={true} onClose={vi.fn()} />,
    );
    expect(screen.getByLabelText(/Code article/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Libellé/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Catégorie/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Unité/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Seuil/)).toBeInTheDocument();
  });

  it('shows supplier dropdown', () => {
    renderWithAll(
      <StockArticleFormDrawer mode="create" open={true} onClose={vi.fn()} />,
    );
    expect(screen.getByText('Pharma Maroc')).toBeInTheDocument();
  });

  it('calls mutateAsync with correct body on submit', async () => {
    upsertArticleMock.mockResolvedValueOnce({});
    renderWithAll(
      <StockArticleFormDrawer mode="create" open={true} onClose={vi.fn()} />,
    );
    fireEvent.change(screen.getByLabelText(/Code article/), { target: { value: 'GANT-M' } });
    fireEvent.change(screen.getByLabelText(/Libellé/), { target: { value: 'Gants M' } });
    fireEvent.change(screen.getByLabelText(/Unité/), { target: { value: 'boîte' } });

    fireEvent.click(screen.getByRole('button', { name: /^Ajouter$/ }));

    await waitFor(() => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expect(upsertArticleMock).toHaveBeenCalledWith(
        'create',
        expect.objectContaining({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          body: expect.objectContaining({ label: 'Gants M' }),
        }),
      );
    });
  });

  it('renders nothing when open=false', () => {
    const { container } = renderWithAll(
      <StockArticleFormDrawer mode="create" open={false} onClose={vi.fn()} />,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithAll(
      <StockArticleFormDrawer mode="create" open={true} onClose={vi.fn()} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

describe('StockArticleFormDrawer — edit mode', () => {
  const mockArticle = {
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
  };

  it('pre-fills form with article data', () => {
    renderWithAll(
      <StockArticleFormDrawer mode="edit" article={mockArticle} open={true} onClose={vi.fn()} />,
    );
    expect(screen.getByDisplayValue('BETADINE-125')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bétadine 10% 125mL')).toBeInTheDocument();
  });

  it('renders code as read-only in edit mode', () => {
    renderWithAll(
      <StockArticleFormDrawer mode="edit" article={mockArticle} open={true} onClose={vi.fn()} />,
    );
    const codeInput = screen.getByDisplayValue('BETADINE-125');
    expect(codeInput).toHaveAttribute('readonly');
  });
});

// ── LotInactivateDialog ───────────────────────────────────────────────────────

import { LotInactivateDialog } from '../components/LotInactivateDialog';

describe('LotInactivateDialog', () => {
  it('renders dialog with lot number', () => {
    renderWithAll(
      <LotInactivateDialog
        articleId="art-1"
        lotId="lot-1"
        lotNumber="L2024-001"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Inactiver le lot/)).toBeInTheDocument();
    expect(screen.getByText(/L2024-001/)).toBeInTheDocument();
  });

  it('renders Annuler and Inactiver buttons', () => {
    renderWithAll(
      <LotInactivateDialog
        articleId="art-1"
        lotId="lot-1"
        lotNumber="L2024-001"
        open={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Annuler/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Inactiver$/ })).toBeInTheDocument();
  });

  it('calls inactivate when "Inactiver" is clicked', async () => {
    inactivateLotMock.mockResolvedValueOnce({});
    const onClose = vi.fn();
    renderWithAll(
      <LotInactivateDialog
        articleId="art-1"
        lotId="lot-1"
        lotNumber="L2024-001"
        open={true}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^Inactiver$/ }));

    await waitFor(() => {
      expect(inactivateLotMock).toHaveBeenCalledWith('lot-1');
    });
  });

  it('calls onClose when "Annuler" is clicked', () => {
    const onClose = vi.fn();
    renderWithAll(
      <LotInactivateDialog
        articleId="art-1"
        lotId="lot-1"
        lotNumber="L2024-001"
        open={true}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Annuler/ }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when open=false', () => {
    const { container } = renderWithAll(
      <LotInactivateDialog
        articleId="art-1"
        lotId="lot-1"
        lotNumber="L2024-001"
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = renderWithAll(
      <LotInactivateDialog
        articleId="art-1"
        lotId="lot-1"
        lotNumber="L2024-001"
        open={true}
        onClose={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});

// ── Sidebar stock badge ───────────────────────────────────────────────────────

vi.mock('@/lib/auth/authStore', () => ({
  useAuthStore: vi.fn(
    (selector: (s: { user: { roles: string[]; permissions: string[] } | null }) => unknown) =>
      selector({ user: { roles: ['MEDECIN'], permissions: [] } }),
  ),
}));

vi.mock('@/features/vaccination/hooks/useVaccinationOverdueCount', () => ({
  useVaccinationOverdueCount: () => 0,
}));

vi.mock('../hooks/useStockAlertsCount', () => ({
  useStockAlertsCount: () => 3,
}));

import { Sidebar } from '@/components/shell/Sidebar';

describe('Sidebar stock badge', () => {
  function renderSidebar() {
    const qc = makeQC();
    return render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <Sidebar active="stock" />
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders the Stock nav item', () => {
    renderSidebar();
    expect(screen.getByText('Stock')).toBeInTheDocument();
  });

  it('renders badge with stock alert count when > 0', () => {
    renderSidebar();
    expect(screen.getByLabelText(/3 en attente/i)).toBeInTheDocument();
  });
});
