/**
 * V047 — saisie structurée des résultats LAB/IMAGING + lecture du graphe
 * d'évolution biologique par patient.
 *
 * Endpoints :
 *   PUT  /api/prescriptions/lines/{lineId}/result-values
 *   GET  /api/prescriptions/lines/{lineId}/result-values
 *   GET  /api/patients/{patientId}/result-trends
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { AxiosError } from 'axios';

export interface ResultValue {
  id: string;
  prescriptionLineId: string;
  analyte: string;
  value: number;
  unit: string | null;
  recordedAt: string;
  sortOrder: number;
}

export interface ResultValueInput {
  analyte: string;
  value: number;
  unit?: string | null;
}

export interface TrendPoint {
  recordedAt: string;
  value: number;
  unit: string | null;
}

export interface TrendSeries {
  analyte: string;
  unit: string | null;
  points: TrendPoint[];
}

const EMPTY_VALUES: ResultValue[] = [];
const EMPTY_TRENDS: TrendSeries[] = [];

export function useResultValues(lineId: string | null | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['result-values', lineId],
    queryFn: () =>
      api
        .get<ResultValue[]>(`/prescriptions/lines/${lineId}/result-values`)
        .then((r) => r.data),
    enabled: !!lineId,
    staleTime: 30_000,
  });
  return {
    values: data ?? EMPTY_VALUES,
    isLoading,
    error: error ? 'Impossible de charger les résultats saisis.' : null,
  };
}

export function useSaveResultValues() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ lineId, values }: { lineId: string; values: ResultValueInput[] }) =>
      api
        .put<ResultValue[]>(`/prescriptions/lines/${lineId}/result-values`, { values })
        .then((r) => r.data),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['result-values', vars.lineId] });
      void qc.invalidateQueries({ queryKey: ['result-trends'] });
    },
  });
  return {
    save: (lineId: string, values: ResultValueInput[]) =>
      mutation.mutateAsync({ lineId, values }),
    isPending: mutation.isPending,
    error: mutation.error as AxiosError | null,
  };
}

export function useResultTrends(patientId: string | null | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['result-trends', patientId],
    queryFn: () =>
      api.get<TrendSeries[]>(`/patients/${patientId}/result-trends`).then((r) => r.data),
    enabled: !!patientId,
    staleTime: 60_000,
  });
  return {
    series: data ?? EMPTY_TRENDS,
    isLoading,
    error: error ? "Impossible de charger l'évolution des analyses." : null,
  };
}
