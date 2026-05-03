import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockSupplier } from '../types';

/**
 * useStockSuppliers — fetches all suppliers.
 * GET /api/stock/suppliers
 */
export function useStockSuppliers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stock', 'suppliers'],
    queryFn: () =>
      api.get<StockSupplier[]>('/stock/suppliers').then((r) => r.data),
    staleTime: 60_000,
  });

  return {
    suppliers: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les fournisseurs.' : null,
  };
}
