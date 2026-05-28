import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import PersonnelPage from '../PersonnelPage';
import { useAuthStore } from '@/lib/auth/authStore';
import type {
  StaffResponse,
  StaffSummary,
  LeaveEntryResponse,
  SalaryPaymentResponse,
} from '../types';

const STAFF: StaffResponse[] = [
  {
    id: 'st-1',
    fullName: 'Fatima Zahra Bennani',
    role: 'SECRETAIRE',
    hireDate: '2024-01-15',
    monthlySalary: 4500,
    phone: '0612345678',
    userId: null,
    active: true,
    notes: null,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
  },
  {
    id: 'st-2',
    fullName: 'Ahmed Idrissi',
    role: 'SECURITE',
    hireDate: '2023-06-01',
    monthlySalary: null,
    phone: null,
    userId: null,
    active: false,
    notes: null,
    createdAt: '2023-06-01T08:00:00Z',
    updatedAt: '2023-06-01T08:00:00Z',
  },
];

const SUMMARY: StaffSummary = {
  staffId: 'st-1',
  monthsWorked: 12,
  accruedLeaveDays: 18,
  takenLeaveDays: 5,
  leaveBalanceDays: 13,
  absencesCount: 2,
  latenessCount: 1,
};

const LEAVE: LeaveEntryResponse[] = [
  { id: 'lv-1', staffId: 'st-1', type: 'CONGE', startDate: '2026-04-01', days: 5, notes: null, createdAt: '2026-04-01T08:00:00Z' },
];

const PAYMENTS: SalaryPaymentResponse[] = [
  { id: 'pay-1', staffId: 'st-1', period: '2026-04', amount: 4500, paidAt: '2026-04-30', notes: null, createdAt: '2026-04-30T08:00:00Z' },
];

const useStaffListMock = vi.fn(() => ({
  staff: STAFF,
  isLoading: false,
  error: null,
  refetch: () => Promise.resolve(),
}));
const useStaffSummaryMock = vi.fn(() => ({ summary: SUMMARY, isLoading: false, error: null }));
const useLeaveEntriesMock = vi.fn(() => ({ entries: LEAVE, isLoading: false, error: null }));
const useSalaryPaymentsMock = vi.fn(() => ({ payments: PAYMENTS, isLoading: false, error: null }));
const noop = () => Promise.resolve();

vi.mock('../hooks/useStaff', () => ({
  useStaffList: (...args: unknown[]) => useStaffListMock(...(args as [])),
  useStaffSummary: (...args: unknown[]) => useStaffSummaryMock(...(args as [])),
  useLeaveEntries: (...args: unknown[]) => useLeaveEntriesMock(...(args as [])),
  useSalaryPayments: (...args: unknown[]) => useSalaryPaymentsMock(...(args as [])),
  useCreateStaff: () => ({ createStaff: noop, isPending: false }),
  useUpdateStaff: () => ({ updateStaff: noop, isPending: false }),
  useDeleteStaff: () => ({ deleteStaff: noop, isPending: false }),
  useCreateLeaveEntry: () => ({ createLeave: noop, isPending: false }),
  useDeleteLeaveEntry: () => ({ deleteLeave: noop, isPending: false }),
  useCreateSalaryPayment: () => ({ createPayment: noop, isPending: false }),
  useDeleteSalaryPayment: () => ({ deletePayment: noop, isPending: false }),
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
    [{ path: '/personnel', element: <PersonnelPage /> }],
    { initialEntries: ['/personnel'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useStaffListMock.mockClear();
  useStaffSummaryMock.mockClear();
});

describe('<PersonnelPage />', () => {
  it('renders a row per staff member with FR role labels, MAD salary and active status', () => {
    renderPage();
    expect(screen.getByText('Fatima Zahra Bennani')).toBeInTheDocument();
    expect(screen.getByText('Ahmed Idrissi')).toBeInTheDocument();
    // FR role label — apparaît dans la table ET dans le filtre Poste de la
    // barre avancée (2026-05-28). On vérifie au moins 1 occurrence.
    expect(screen.getAllByText('Secrétaire').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Agent de sécurité').length).toBeGreaterThan(0);
    // MAD salary formatting (comma decimal)
    expect(screen.getByText('4500,00 MAD')).toBeInTheDocument();
    // active / inactive chips
    expect(screen.getByText('Actif')).toBeInTheDocument();
    expect(screen.getByText('Inactif')).toBeInTheDocument();
  });

  it('opens the add form when clicking "Ajouter un membre"', () => {
    renderPage();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ajouter un membre/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Nouveau membre')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom complet/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Poste *')).toBeInTheDocument();
    expect(screen.getByLabelText(/Salaire mensuel/i)).toBeInTheDocument();
  });

  it('shows the accrued / balance leave labels in the detail panel for a selected staff', () => {
    renderPage();
    // Open the detail drawer by clicking the staff name.
    fireEvent.click(screen.getByText('Fatima Zahra Bennani'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // Leave summary labels from /summary.
    expect(screen.getByText(/Solde congés : 13 j/)).toBeInTheDocument();
    expect(screen.getByText(/Acquis : 18 j \(12 mois × 1,5\)/)).toBeInTheDocument();
    expect(screen.getByText(/Pris : 5 j/)).toBeInTheDocument();
    expect(screen.getByText(/Absences : 2/)).toBeInTheDocument();
    expect(screen.getByText(/Retards : 1/)).toBeInTheDocument();
    // Salary payment listed.
    expect(screen.getByText('2026-04')).toBeInTheDocument();
  });
});
