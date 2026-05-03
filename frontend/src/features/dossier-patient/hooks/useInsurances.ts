import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface InsuranceApi {
  id: string;
  code: string;
  name: string;
  kind: 'AMO' | 'MUTUELLE' | 'PRIVEE';
}

export function useInsurances() {
  const { data, isLoading } = useQuery({
    queryKey: ['insurances'],
    queryFn: () => api.get<InsuranceApi[]>('/catalog/insurances').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  return {
    insurances: data ?? [],
    isLoading,
  };
}
