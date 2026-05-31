import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  enabled: boolean;
  roles: string[];
  /** V040 — practitioner credentials. Null for non-MEDECIN users. */
  specialty?: string | null;
  inpe?: string | null;
  cnom?: string | null;
  cnops?: string | null;
  /** V031/V035 — true if a signature_blob is stored. */
  hasSignature?: boolean;
}

/**
 * Vue détaillée renvoyée par GET /api/admin/users/{id}.
 * Contient les champs étendus V032 (specialty + assignedPractitionerIds) que
 * la liste légère ne renvoie pas.
 */
export interface AdminUserDetail {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
  assignedPractitionerIds: string[];
}

export interface CreateUserForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  roles: string[];
  /** V032 — visible UNIQUEMENT si rôle MEDECIN. Omettre = null serveur. */
  specialty?: string;
  /** V040 — practitioner credentials (MEDECIN only). */
  inpe?: string;
  cnom?: string;
  cnops?: string;
  /**
   * V032 — uniquement quand rôle ∈ {SECRETAIRE, ASSISTANT}. Omettre = auto-assign
   * à tous les médecins actifs côté serveur (sensible pour cabinet 1 médecin).
   */
  assignedPractitionerIds?: string[];
}

export interface UpdateUserPayload {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  specialty?: string | null;
  roles?: string[];
  enabled?: boolean;
  /**
   * Sémantique V032 : `undefined` = ne pas toucher (le serveur ignore le champ
   * absent), `[]` = vider, `[ids]` = remplacer.
   */
  assignedPractitionerIds?: string[];
}

export function useUsers() {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get<AdminUser[]>('/admin/users').then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    users: data ?? [],
    isLoading,
    error: error ? t('settings.errors.loadUsers') : null,
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

export function useUpdateUser() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      api.put<AdminUserDetail>(`/admin/users/${id}`, payload).then((r) => r.data),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-user', variables.id] });
      void qc.invalidateQueries({ queryKey: ['practitioners'] });
    },
  });
  return {
    updateUser: mutation.mutateAsync,
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
      void qc.invalidateQueries({ queryKey: ['practitioners'] });
    },
  });
  return {
    deactivateUser: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/**
 * V044 — Admin resets a user's password.
 *
 * <p>The backend BCrypts the new password, flips
 * {@code password_change_required = TRUE} on the target user (forcing them
 * to pick a new password at next login) and revokes their active refresh
 * tokens. The 12-character minimum mirrors {@link useCreateUser}.
 */
export function useResetUserPassword() {
  const mutation = useMutation({
    mutationFn: async (vars: { id: string; password: string }): Promise<void> => {
      await api.post(`/admin/users/${vars.id}/reset-password`, {
        password: vars.password,
      });
    },
  });
  return {
    resetPassword: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/**
 * V044 — Self-service password change. Used by ForceChangePasswordPage (when
 * the admin force-flagged the account) and by future "Mon profil" surfaces.
 */
export function useChangeOwnPassword() {
  const mutation = useMutation({
    mutationFn: async (vars: { currentPassword: string; newPassword: string }): Promise<void> => {
      await api.post(`/users/me/change-password`, vars);
    },
  });
  return {
    changePassword: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
