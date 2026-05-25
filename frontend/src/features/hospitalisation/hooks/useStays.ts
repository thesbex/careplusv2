/**
 * Hooks du cycle de vie séjour (Slice B+D) : worklist hospitalisés, détail,
 * admission, transfert, sortie, annulation, facturation.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type StayStatus = 'EN_COURS' | 'SORTI' | 'FACTURE' | 'ANNULE';
export type DischargeType = 'DOMICILE' | 'TRANSFERT_EXT' | 'CONTRE_AVIS' | 'DECES';

export interface StayQueueEntry {
  stayId: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  admissionReason: string | null;
  admittedAt: string;
  daysSoFar: number;
  bedLabel: string | null;
  wardLabel: string | null;
  attendingPractitionerId: string | null;
}

export interface AssignmentView {
  id: string;
  bedId: string;
  bedLabel: string | null;
  wardLabel: string | null;
  dailyRate: number;
  fromAt: string;
  toAt: string | null;
  nights: number;
}

export interface ChargeLine {
  description: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface StayDetail {
  id: string;
  patientId: string;
  patientFirstName: string;
  patientLastName: string;
  status: StayStatus;
  admissionReason: string | null;
  attendingPractitionerId: string | null;
  admittedAt: string;
  dischargedAt: string | null;
  dischargeType: DischargeType | null;
  dischargeSummary: string | null;
  invoiceId: string | null;
  assignments: AssignmentView[];
  chargePreview: ChargeLine[];
  chargeTotal: number;
}

export const DISCHARGE_TYPE_LABELS: Record<DischargeType, string> = {
  DOMICILE: 'Retour à domicile',
  TRANSFERT_EXT: 'Transfert externe',
  CONTRE_AVIS: 'Sortie contre avis médical',
  DECES: 'Décès',
};

const EMPTY: StayQueueEntry[] = [];

export function useStayQueue() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hosp-stays-queue'],
    queryFn: () => api.get<StayQueueEntry[]>('/hospitalization/stays/queue').then((r) => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  return { stays: data ?? EMPTY, isLoading, error: error ? 'Impossible de charger les séjours.' : null };
}

export function useActiveStayCount(enabled = true) {
  const { data } = useQuery({
    queryKey: ['hosp-stays-count'],
    queryFn: () => api.get<StayQueueEntry[]>('/hospitalization/stays/queue').then((r) => r.data.length),
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled,
  });
  return data ?? 0;
}

export function usePatientStays(patientId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hosp-patient-stays', patientId],
    queryFn: () => api.get<StayDetail[]>(`/hospitalization/stays?patientId=${patientId}`).then((r) => r.data),
    enabled: !!patientId,
  });
  return { stays: data ?? [], isLoading, error: error ? 'Impossible de charger les séjours.' : null };
}

export function useStayDetail(stayId: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hosp-stay', stayId],
    queryFn: () => api.get<StayDetail>(`/hospitalization/stays/${stayId}`).then((r) => r.data),
    enabled: !!stayId,
  });
  return { stay: data ?? null, isLoading, error: error ? 'Impossible de charger le séjour.' : null };
}

function useStayMutation<TVars>(fn: (v: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-stays-queue'] });
      void qc.invalidateQueries({ queryKey: ['hosp-stays-count'] });
      void qc.invalidateQueries({ queryKey: ['hosp-stay'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return m;
}

export interface AdmitPayload {
  patientId: string;
  bedId: string;
  attendingPractitionerId?: string;
  admissionReason?: string;
}

export function useAdmit() {
  const m = useStayMutation((p: AdmitPayload) =>
    api.post<StayDetail>('/hospitalization/stays/admit', p).then((r) => r.data));
  return { admit: m.mutateAsync, isPending: m.isPending };
}

export function useTransfer() {
  const m = useStayMutation(({ stayId, bedId }: { stayId: string; bedId: string }) =>
    api.post<StayDetail>(`/hospitalization/stays/${stayId}/transfer`, { bedId }).then((r) => r.data));
  return { transfer: m.mutateAsync, isPending: m.isPending };
}

export function useDischarge() {
  const m = useStayMutation(
    ({ stayId, dischargeType, dischargeSummary }:
      { stayId: string; dischargeType: DischargeType; dischargeSummary?: string }) =>
      api.post<StayDetail>(`/hospitalization/stays/${stayId}/discharge`,
        { dischargeType, dischargeSummary }).then((r) => r.data));
  return { discharge: m.mutateAsync, isPending: m.isPending };
}

export function useCancelStay() {
  const m = useStayMutation((stayId: string) =>
    api.post(`/hospitalization/stays/${stayId}/cancel`));
  return { cancelStay: m.mutateAsync, isPending: m.isPending };
}

export function useGenerateStayInvoice() {
  const m = useStayMutation((stayId: string) =>
    api.post<{ invoiceId: string }>(`/hospitalization/stays/${stayId}/invoice`).then((r) => r.data));
  return { generateInvoice: m.mutateAsync, isPending: m.isPending };
}

// ── Constantes au lit (Slice C) ──────────────────────────────────────────

export interface StayVitals {
  id: string;
  systolicMmhg: number | null;
  diastolicMmhg: number | null;
  temperatureC: number | null;
  weightKg: number | null;
  heartRateBpm: number | null;
  spo2Percent: number | null;
  glycemiaGPerL: number | null;
  notes: string | null;
  recordedAt: string;
}

const EMPTY_VITALS: StayVitals[] = [];

export function useStayVitals(stayId: string | null) {
  const { data } = useQuery({
    queryKey: ['hosp-stay-vitals', stayId],
    queryFn: () => api.get<StayVitals[]>(`/hospitalization/stays/${stayId}/vitals`).then((r) => r.data),
    enabled: !!stayId,
  });
  return { vitals: data ?? EMPTY_VITALS };
}

export interface StayVitalsPayload {
  systolicMmhg?: number;
  diastolicMmhg?: number;
  temperatureC?: number;
  heartRateBpm?: number;
  spo2Percent?: number;
  glycemiaGPerL?: number;
  notes?: string;
}

export function useRecordStayVitals() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ stayId, payload }: { stayId: string; payload: StayVitalsPayload }) =>
      api.post<StayVitals>(`/hospitalization/stays/${stayId}/vitals`, payload).then((r) => r.data),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: ['hosp-stay-vitals', vars.stayId] });
    },
  });
  return { recordVitals: m.mutateAsync, isPending: m.isPending };
}
