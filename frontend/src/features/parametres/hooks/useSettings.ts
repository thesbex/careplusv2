import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface ClinicSettings {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string | null;
  inpe: string | null;
  cnom: string | null;
  ice: string | null;
  rib: string | null;
}

export interface ClinicSettingsForm {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  inpe: string;
  cnom: string;
  ice: string;
  rib: string;
}

export interface TierConfig {
  id: string;
  tier: 'NORMAL' | 'PREMIUM';
  discountPercent: number;
}

export function useClinicSettings() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['clinic-settings'],
    queryFn: () =>
      api
        .get<ClinicSettings>('/settings/clinic')
        .then((r) => r.data)
        .catch(() => null),
    staleTime: 60_000,
  });

  return {
    settings: data ?? null,
    isLoading,
    error: error ? 'Impossible de charger les paramètres cabinet.' : null,
  };
}

export function useUpdateClinicSettings() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (form: ClinicSettingsForm) =>
      api.put<ClinicSettings>('/settings/clinic', form).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['clinic-settings'], data);
    },
  });
  return {
    update: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useTiers() {
  const { data, isLoading } = useQuery({
    queryKey: ['tier-config'],
    queryFn: () => api.get<TierConfig[]>('/settings/tiers').then((r) => r.data),
    staleTime: 60_000,
  });
  return { tiers: data ?? [], isLoading };
}

export function useUpdateTierDiscount() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ tier, discountPercent }: { tier: 'NORMAL' | 'PREMIUM'; discountPercent: number }) =>
      api
        .put<TierConfig>(`/settings/tiers/${tier}`, { tier, discountPercent })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tier-config'] });
    },
  });
  return {
    updateTier: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
