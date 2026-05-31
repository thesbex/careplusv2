/**
 * Hooks pour le CRUD des salles de consultation (V033).
 *
 * Le contrôleur backend (`/api/rooms`) restreint POST/PUT/DELETE aux ADMIN ;
 * la liste avec `includeInactive=true` est accessible aux rôles authentifiés.
 * Les composants gèrent leur propre garde de visibilité du bouton.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';

export interface RoomView {
  id: string;
  name: string;
  capabilityTags: string[];
  active: boolean;
}

export interface CreateRoomPayload {
  name: string;
  capabilityTags: string[];
}

export interface UpdateRoomPayload {
  name: string;
  capabilityTags: string[];
  active?: boolean;
}

const STABLE_EMPTY: RoomView[] = [];

export function useRoomsList() {
  const { t } = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['rooms', { includeInactive: true }],
    queryFn: () =>
      api
        .get<RoomView[]>('/rooms', { params: { includeInactive: true } })
        .then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    rooms: data ?? STABLE_EMPTY,
    isLoading,
    error: error ? t('settings.errors.loadRooms') : null,
  };
}

export function useCreateRoom() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: CreateRoomPayload) =>
      api.post<RoomView>('/rooms', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
  return {
    createRoom: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRoomPayload }) =>
      api.put<RoomView>(`/rooms/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
  return {
    updateRoom: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useDeactivateRoom() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/rooms/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
  return {
    deactivateRoom: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
