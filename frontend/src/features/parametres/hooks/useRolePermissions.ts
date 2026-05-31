import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export type RoleCode =
  | 'SECRETAIRE'
  | 'ASSISTANT'
  | 'MEDECIN'
  | 'ADMIN'
  | 'RECEPTIONNISTE';

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
  const { t } = useT();
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
    error: error ? t('settings.errors.loadPermissions') : null,
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
