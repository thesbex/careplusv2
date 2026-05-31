import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  ExpenseResponse,
  ExpenseRequest,
  ExpenseFilters,
  MonthlyTotal,
} from '../types';

/** GET /api/expenses?category=&from=&to= — liste non supprimée, expense_date DESC. */
export function useExpenses(filters: ExpenseFilters = {}) {
  const { category, from, to } = filters;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['expenses', category ?? '', from ?? '', to ?? ''],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (category) params.category = category;
      if (from) params.from = from;
      if (to) params.to = to;
      return api.get<ExpenseResponse[]>('/expenses', { params }).then((r) => r.data);
    },
    staleTime: 10_000,
  });

  return {
    expenses: data ?? [],
    isLoading,
    // i18n (#122) : clé de traduction (les hooks ne peuvent pas appeler useT) ;
    // le consommateur passe la valeur à t(). Aucun écran charges ne l'affiche
    // aujourd'hui, mais on garde le contrat i18n cohérent.
    error: error ? 'charges.err.loadList' : null,
    refetch,
  };
}

/** GET /api/expenses/summary?year=YYYY — totaux mensuels de l'année. */
export function useExpenseSummary(year: number) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['expenses-summary', year],
    queryFn: () =>
      api
        .get<MonthlyTotal[]>('/expenses/summary', { params: { year } })
        .then((r) => r.data),
    staleTime: 10_000,
  });

  return {
    summary: data ?? [],
    isLoading,
    // i18n (#122) : clé de traduction (voir useExpenses ci-dessus).
    error: error ? 'charges.err.loadSummary' : null,
  };
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['expenses'] });
  void qc.invalidateQueries({ queryKey: ['expenses-summary'] });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: ExpenseRequest) =>
      api.post<ExpenseResponse>('/expenses', body).then((r) => r.data),
    onSuccess: () => invalidate(qc),
  });
  return { createExpense: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ExpenseRequest }) =>
      api.put<ExpenseResponse>(`/expenses/${id}`, body).then((r) => r.data),
    onSuccess: () => invalidate(qc),
  });
  return { updateExpense: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`).then(() => undefined),
    onSuccess: () => invalidate(qc),
  });
  return { deleteExpense: mutation.mutateAsync, isPending: mutation.isPending };
}
