import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { StockSupplier } from '../types';

export interface UpsertSupplierBody {
  name: string;
  phone?: string;
  active: boolean;
}

/**
 * Create (POST) or update (PUT) a supplier.
 * mode='create' → POST /api/stock/suppliers
 * mode='edit'   → PUT  /api/stock/suppliers/:id
 * Invalidates ['stock', 'suppliers'] on success.
 */
export function useUpsertSupplier(mode: 'create' | 'edit') {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: UpsertSupplierBody }) => {
      if (mode === 'edit' && id) {
        return api.put<StockSupplier>(`/stock/suppliers/${id}`, body).then((r) => r.data);
      }
      return api.post<StockSupplier>('/stock/suppliers', body).then((r) => r.data);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock', 'suppliers'] });
    },
  });
}
