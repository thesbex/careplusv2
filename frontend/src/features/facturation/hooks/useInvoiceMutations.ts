import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { InvoiceApi, InvoiceLineDraft, PaymentMode } from '../types';

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['invoices'] });
  void qc.invalidateQueries({ queryKey: ['invoice'] });
  void qc.invalidateQueries({ queryKey: ['invoice-by-consult'] });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      id,
      lines,
      discountAmount,
    }: {
      id: string;
      lines: InvoiceLineDraft[];
      discountAmount: number;
    }) =>
      api
        .put<InvoiceApi>(`/invoices/${id}`, {
          lines: lines.map((l) => ({
            actId: null,
            description: l.description,
            unitPrice: l.unitPrice,
            quantity: l.quantity,
          })),
          discountAmount,
        })
        .then((r) => r.data),
    onSuccess: () => invalidate(qc),
  });

  return {
    updateInvoice: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) =>
      api.post<{ number: string; issuedAt: string }>(`/invoices/${id}/issue`).then((r) => r.data),
    onSuccess: () => invalidate(qc),
  });

  return {
    issueInvoice: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useRecordPayment() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({
      id,
      amount,
      mode,
      reference,
    }: {
      id: string;
      amount: number;
      mode: PaymentMode;
      reference?: string;
    }): Promise<void> => {
      await api.post(`/invoices/${id}/payments`, {
        amount,
        mode,
        reference: reference ?? null,
        paidAt: null,
      });
    },
    onSuccess: () => invalidate(qc),
  });

  return {
    recordPayment: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useCreditNote() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }): Promise<void> => {
      await api.post(`/invoices/${id}/credit-note`, { reason });
    },
    onSuccess: () => invalidate(qc),
  });

  return {
    issueCreditNote: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useAdjustInvoiceTotal() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({
      consultationId,
      discountAmount,
    }: {
      consultationId: string;
      discountAmount: number;
    }) =>
      api
        .put<InvoiceApi>(`/consultations/${consultationId}/invoice-total`, {
          discountAmount,
        })
        .then((r) => r.data),
    onSuccess: () => invalidate(qc),
  });

  return {
    adjustTotal: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
