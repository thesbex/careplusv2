import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  enabled: boolean;
  roles: string[];
}

export interface CreateUserForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  roleNames: string[];
}

export function useUsers() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUser[]>('/admin/users').then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    users: data ?? [],
    isLoading,
    error: error ? 'Impossible de charger les utilisateurs.' : null,
  };
}

export function useCreateUser() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (form: CreateUserForm) =>
      api.post<AdminUser>('/admin/users', form).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  return {
    createUser: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/admin/users/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  return {
    deactivateUser: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
