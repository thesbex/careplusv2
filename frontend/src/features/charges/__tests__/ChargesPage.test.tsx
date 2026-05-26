import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ChargesPage from '../ChargesPage';
import { useAuthStore } from '@/lib/auth/authStore';
import type { ExpenseResponse, MonthlyTotal } from '../types';

const EXPENSES: ExpenseResponse[] = [
  {
    id: 'exp-1',
    category: 'LOYER',
    label: 'Loyer du local avril',
    amount: 5000,
    expenseDate: '2026-04-01',
    periodicity: 'MENSUELLE',
    supplier: 'SCI El Amrani',
    notes: null,
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
  },
  {
    id: 'exp-2',
    category: 'EAU_ELECTRICITE',
    label: 'Facture Lydec',
    amount: 1250.5,
    expenseDate: '2026-04-10',
    periodicity: 'PONCTUELLE',
    supplier: 'Lydec',
    notes: 'Relevé compteur',
    createdAt: '2026-04-10T08:00:00Z',
    updatedAt: '2026-04-10T08:00:00Z',
  },
];

const SUMMARY: MonthlyTotal[] = [
  { month: 4, total: 6250.5 },
];

const useExpensesMock = vi.fn(() => ({
  expenses: EXPENSES,
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
}));
const useExpenseSummaryMock = vi.fn(() => ({
  summary: SUMMARY,
  isLoading: false,
  error: null,
}));
const createExpenseMock = vi.fn(() => Promise.resolve());
const updateExpenseMock = vi.fn(() => Promise.resolve());
const deleteExpenseMock = vi.fn(() => Promise.resolve());

vi.mock('../hooks/useExpenses', () => ({
  useExpenses: (...args: unknown[]) => useExpensesMock(...(args as [])),
  useExpenseSummary: (...args: unknown[]) => useExpenseSummaryMock(...(args as [])),
  useCreateExpense: () => ({ createExpense: createExpenseMock, isPending: false }),
  useUpdateExpense: () => ({ updateExpense: updateExpenseMock, isPending: false }),
  useDeleteExpense: () => ({ deleteExpense: deleteExpenseMock, isPending: false }),
}));

function renderPage() {
  useAuthStore.setState({
    accessToken: 'tok',
    user: { id: 'u1', email: 'a@test', firstName: 'A', lastName: 'D', roles: ['ADMIN'], permissions: [] },
  });
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [{ path: '/charges', element: <ChargesPage /> }],
    { initialEntries: ['/charges'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useExpensesMock.mockClear();
  useExpenseSummaryMock.mockClear();
  createExpenseMock.mockClear();
});

describe('<ChargesPage />', () => {
  it('renders a table row per expense with FR category labels and MAD amounts', () => {
    renderPage();
    expect(screen.getByText('Loyer du local avril')).toBeInTheDocument();
    expect(screen.getByText('Facture Lydec')).toBeInTheDocument();
    // FR category label mapping — labels also appear in the filter <select>,
    // so assert at least one occurrence (table chip) exists.
    expect(screen.getAllByText('Loyer').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Eau / Électricité').length).toBeGreaterThan(0);
    // FR periodicity label (table only)
    expect(screen.getByText('Mensuelle')).toBeInTheDocument();
    // MAD formatting (comma decimal)
    expect(screen.getByText('5000,00 MAD')).toBeInTheDocument();
    expect(screen.getByText('1250,50 MAD')).toBeInTheDocument();
  });

  it('shows the annual total from the summary endpoint', () => {
    renderPage();
    expect(screen.getByText(/Total 2026 : 6250,50 MAD/)).toBeInTheDocument();
  });

  it('opens the add form when clicking "Ajouter une charge"', () => {
    renderPage();
    // The drawer/dialog is not present initially.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter une charge/i }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Nouvelle charge')).toBeInTheDocument();
    // Form controls are present
    expect(screen.getByLabelText(/Libellé/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Montant/i)).toBeInTheDocument();
    // "Catégorie *" (form) — distinct from the "Filtrer par catégorie" select.
    expect(screen.getByLabelText('Catégorie *')).toBeInTheDocument();
  });
});
