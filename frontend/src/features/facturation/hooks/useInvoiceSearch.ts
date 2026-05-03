import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { InvoiceSearchFilters, InvoiceSearchResponse } from '../types';

/**
 * Backend search endpoint with full filter set + paginated results + KPI aggregates.
 * Replaces the legacy {@code useInvoices(status)} for the Facturation screen.
 */
export function useInvoiceSearch(filters: InvoiceSearchFilters, page = 0, size = 50) {
  const params = filtersToParams(filters, page, size);
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['invoices-search', params],
    queryFn: () =>
      api
        .get<InvoiceSearchResponse>('/invoices/search', {
          params,
          // Spring @RequestParam List<> expects ?key=a&key=b, not ?key[]=a&key[]=b.
          paramsSerializer: { indexes: null },
        })
        .then((r) => r.data),
    staleTime: 10_000,
  });

  return {
    response: data ?? null,
    items: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    totalNet: data?.totalNet ?? 0,
    totalPaid: data?.totalPaid ?? 0,
    totalRemaining: data?.totalRemaining ?? 0,
    isLoading,
    error: error ? 'Impossible de charger les factures.' : null,
    refetch,
  };
}

export function filtersToParams(filters: InvoiceSearchFilters, page: number, size: number): Record<string, unknown> {
  const out: Record<string, unknown> = { page, size };
  if (filters.dateField !== 'ISSUED') out.dateField = filters.dateField;
  if (filters.from) out.from = filters.from;
  if (filters.to) out.to = filters.to;
  if (filters.statuses.length) out.status = filters.statuses;
  if (filters.paymentModes.length) out.paymentMode = filters.paymentModes;
  if (filters.patientId) out.patientId = filters.patientId;
  if (filters.amountMin !== null) out.amountMin = filters.amountMin;
  if (filters.amountMax !== null) out.amountMax = filters.amountMax;
  return out;
}
