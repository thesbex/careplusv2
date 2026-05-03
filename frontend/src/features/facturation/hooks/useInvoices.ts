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

export function useInvoicesForPatient(patientId?: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['invoices', 'patient', patientId],
    queryFn: () =>
      api.get<InvoiceApi[]>('/invoices', { params: { patientId } }).then((r) => r.data),
    enabled: !!patientId,
    staleTime: 10_000,
  });

  return {
    invoices: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les factures.' : null,
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

export function useInvoiceByConsultation(consultationId?: string, opts?: { pollUntilFound?: boolean }) {
  const { data, isLoading, refetch } = useQuery<InvoiceApi | null>({
    queryKey: ['invoice-by-consult', consultationId],
    queryFn: () =>
      api
        .get<InvoiceApi>(`/consultations/${consultationId}/invoice`)
        .then((r) => r.data)
        .catch(() => null),
    enabled: !!consultationId,
    staleTime: 5_000,
    // Quand on attend la création async du brouillon (post-signature
    // AFTER_COMMIT listener), on poll toutes les 500 ms jusqu'à ce que
    // le brouillon apparaisse.
    refetchInterval: (query) =>
      opts?.pollUntilFound && !query.state.data ? 500 : false,
  });

  return { invoice: data ?? null, isLoading, refetch };
}
