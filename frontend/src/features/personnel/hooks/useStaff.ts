import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  StaffResponse,
  StaffRequest,
  StaffFilters,
  StaffSummary,
  LeaveEntryResponse,
  LeaveEntryRequest,
  SalaryPaymentResponse,
  SalaryPaymentRequest,
} from '../types';

/** GET /api/hr/staff?active=&role= */
export function useStaffList(filters: StaffFilters = {}) {
  const { active, role } = filters;
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['hr-staff', active ?? '', role ?? ''],
    queryFn: () => {
      const params: Record<string, string | boolean> = {};
      if (active !== undefined) params.active = active;
      if (role) params.role = role;
      return api.get<StaffResponse[]>('/hr/staff', { params }).then((r) => r.data);
    },
    staleTime: 10_000,
  });

  return {
    staff: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger le personnel.' : null,
    refetch,
  };
}

/** GET /api/hr/staff/{id} */
export function useStaffMember(id: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-staff', 'detail', id],
    queryFn: () => api.get<StaffResponse>(`/hr/staff/${id}`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });
  return {
    member: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger le membre.' : null,
  };
}

/** GET /api/hr/staff/{id}/summary */
export function useStaffSummary(id: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-staff', 'summary', id],
    queryFn: () => api.get<StaffSummary>(`/hr/staff/${id}/summary`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });
  return {
    summary: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger le récapitulatif.' : null,
  };
}

/** GET /api/hr/staff/{id}/leave */
export function useLeaveEntries(id: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-leave', id],
    queryFn: () => api.get<LeaveEntryResponse[]>(`/hr/staff/${id}/leave`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });
  return {
    entries: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les congés.' : null,
  };
}

/** GET /api/hr/staff/{id}/payments */
export function useSalaryPayments(id: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hr-payments', id],
    queryFn: () =>
      api.get<SalaryPaymentResponse[]>(`/hr/staff/${id}/payments`).then((r) => r.data),
    enabled: !!id,
    staleTime: 10_000,
  });
  return {
    payments: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les paiements.' : null,
  };
}

function invalidateStaff(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['hr-staff'] });
}

export function useCreateStaff() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: StaffRequest) =>
      api.post<StaffResponse>('/hr/staff', body).then((r) => r.data),
    onSuccess: () => invalidateStaff(qc),
  });
  return { createStaff: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useUpdateStaff() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: StaffRequest }) =>
      api.put<StaffResponse>(`/hr/staff/${id}`, body).then((r) => r.data),
    onSuccess: () => invalidateStaff(qc),
  });
  return { updateStaff: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteStaff() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (id: string) => api.delete(`/hr/staff/${id}`).then(() => undefined),
    onSuccess: () => invalidateStaff(qc),
  });
  return { deleteStaff: mutation.mutateAsync, isPending: mutation.isPending };
}

function invalidateLeave(qc: ReturnType<typeof useQueryClient>, staffId: string) {
  void qc.invalidateQueries({ queryKey: ['hr-leave', staffId] });
  void qc.invalidateQueries({ queryKey: ['hr-staff', 'summary', staffId] });
}

export function useCreateLeaveEntry() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ staffId, body }: { staffId: string; body: LeaveEntryRequest }) =>
      api.post<LeaveEntryResponse>(`/hr/staff/${staffId}/leave`, body).then((r) => r.data),
    onSuccess: (_d, { staffId }) => invalidateLeave(qc, staffId),
  });
  return { createLeave: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteLeaveEntry() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id }: { id: string; staffId: string }) =>
      api.delete(`/hr/leave/${id}`).then(() => undefined),
    onSuccess: (_d, { staffId }) => invalidateLeave(qc, staffId),
  });
  return { deleteLeave: mutation.mutateAsync, isPending: mutation.isPending };
}

function invalidatePayments(qc: ReturnType<typeof useQueryClient>, staffId: string) {
  void qc.invalidateQueries({ queryKey: ['hr-payments', staffId] });
}

export function useCreateSalaryPayment() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ staffId, body }: { staffId: string; body: SalaryPaymentRequest }) =>
      api.post<SalaryPaymentResponse>(`/hr/staff/${staffId}/payments`, body).then((r) => r.data),
    onSuccess: (_d, { staffId }) => invalidatePayments(qc, staffId),
  });
  return { createPayment: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteSalaryPayment() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id }: { id: string; staffId: string }) =>
      api.delete(`/hr/payments/${id}`).then(() => undefined),
    onSuccess: (_d, { staffId }) => invalidatePayments(qc, staffId),
  });
  return { deletePayment: mutation.mutateAsync, isPending: mutation.isPending };
}
