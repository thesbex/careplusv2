import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type RoleCode = 'SECRETAIRE' | 'ASSISTANT' | 'MEDECIN' | 'ADMIN';

export interface RolePermissionRow {
  roleCode: RoleCode;
  permission: string;
  granted: boolean;
}

export interface PermissionFlag {
  permission: string;
  granted: boolean;
}

export function useRolePermissions() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['settings-role-permissions'],
    queryFn: () =>
      api
        .get<RolePermissionRow[]>('/settings/role-permissions')
        .then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    rows: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger la matrice des droits.' : null,
    refetch,
  };
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ roleCode, permissions }: { roleCode: RoleCode; permissions: PermissionFlag[] }) =>
      api
        .put<RolePermissionRow[]>(`/settings/role-permissions/${roleCode}`, { permissions })
        .then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings-role-permissions'] });
    },
  });
  return {
    update: m.mutateAsync,
    isPending: m.isPending,
  };
}
