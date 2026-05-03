import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { InvoiceApi, InvoiceStatus } from '../types';

export function useInvoices(status?: InvoiceStatus | 'ALL') {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices', status ?? 'ALL'],
    queryFn: () => {
      const params = status && status !== 'ALL' ? { status } : {};
      return api.get<InvoiceApi[]>('/invoices', { params }).then((r) => r.data);
    },
    staleTime: 10_000,
  });

  return {
    invoices: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les factures.' : null,
    refetch,
  };
}

export function useInvoice(id?: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => api.get<InvoiceApi>(`/invoices/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });

  return {
    invoice: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger la facture.' : null,
    refetch,
  };
}

export function useInvoiceByConsultation(consultationId?: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['invoice-by-consult', consultationId],
    queryFn: () =>
      api
        .get<InvoiceApi>(`/consultations/${consultationId}/invoice`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: !!consultationId,
    staleTime: 5_000,
  });

  return { invoice: data ?? null, isLoading };
}
