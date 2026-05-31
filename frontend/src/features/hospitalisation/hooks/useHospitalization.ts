/**
 * Hooks du référentiel hospitalisation (Slice A) — services / chambres / lits + board.
 *
 * Backend `/api/hospitalization/*` : lecture pour tous les rôles soignants,
 * écriture MEDECIN/ADMIN, toggle statut lit pour SECRETAIRE/INFIRMIER/MEDECIN/ADMIN.
 * Le module n'est visible que si `hospitalizationEnabled` est coché côté Paramétrage.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type RoomClass = 'INDIVIDUELLE' | 'DOUBLE' | 'COMMUNE' | 'SUITE' | 'AUTRE';
export type BedStatus = 'LIBRE' | 'OCCUPE' | 'RESERVE' | 'NETTOYAGE' | 'HORS_SERVICE';
/** Statuts settables manuellement (OCCUPE est dérivé d'un séjour, Slice B). */
export type ManualBedStatus = 'LIBRE' | 'RESERVE' | 'NETTOYAGE' | 'HORS_SERVICE';

export interface WardView {
  id: string;
  code: string;
  labelFr: string;
  active: boolean;
}

export interface RoomView {
  id: string;
  wardId: string;
  code: string;
  labelFr: string;
  roomClass: RoomClass;
  dailyRate: number;
  active: boolean;
}

export interface BedView {
  id: string;
  roomId: string;
  code: string;
  status: BedStatus;
  active: boolean;
}

export interface RoomBoard {
  roomId: string;
  roomCode: string;
  roomLabel: string;
  roomClass: RoomClass;
  dailyRate: number;
  beds: BedView[];
}

export interface WardBoard {
  wardId: string;
  wardCode: string;
  wardLabel: string;
  rooms: RoomBoard[];
}

export interface BedBoard {
  wards: WardBoard[];
}

/** Clés i18n des classes de chambre (résolues via `t()` au rendu). */
export const ROOM_CLASS_KEYS: Record<RoomClass, string> = {
  INDIVIDUELLE: 'hospit.roomClass.INDIVIDUELLE',
  DOUBLE: 'hospit.roomClass.DOUBLE',
  COMMUNE: 'hospit.roomClass.COMMUNE',
  SUITE: 'hospit.roomClass.SUITE',
  AUTRE: 'hospit.roomClass.AUTRE',
};

/** Clés i18n des statuts de lit (résolues via `t()` au rendu). */
export const BED_STATUS_KEYS: Record<BedStatus, string> = {
  LIBRE: 'hospit.bedStatus.LIBRE',
  OCCUPE: 'hospit.bedStatus.OCCUPE',
  RESERVE: 'hospit.bedStatus.RESERVE',
  NETTOYAGE: 'hospit.bedStatus.NETTOYAGE',
  HORS_SERVICE: 'hospit.bedStatus.HORS_SERVICE',
};

const EMPTY_WARDS: WardView[] = [];
const EMPTY_ROOMS: RoomView[] = [];
const EMPTY_BEDS: BedView[] = [];

// ── Wards ──────────────────────────────────────────────────────────────

export function useWards() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hosp-wards', { includeInactive: true }],
    queryFn: () =>
      api
        .get<WardView[]>('/hospitalization/wards', { params: { includeInactive: true } })
        .then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    wards: data ?? EMPTY_WARDS,
    isLoading,
    error: error ? 'hospit.error.wards' : null,
  };
}

export function useCreateWard() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (payload: { code: string; labelFr: string }) =>
      api.post<WardView>('/hospitalization/wards', payload).then((r) => r.data),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['hosp-wards'] }),
  });
  return { createWard: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateWard() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { code: string; labelFr: string; active?: boolean } }) =>
      api.put<WardView>(`/hospitalization/wards/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-wards'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { updateWard: m.mutateAsync, isPending: m.isPending };
}

export function useDeactivateWard() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/hospitalization/wards/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-wards'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { deactivateWard: m.mutateAsync, isPending: m.isPending };
}

// ── Rooms ──────────────────────────────────────────────────────────────

export function useRooms() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hosp-rooms', { includeInactive: true }],
    queryFn: () =>
      api
        .get<RoomView[]>('/hospitalization/rooms', { params: { includeInactive: true } })
        .then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    rooms: data ?? EMPTY_ROOMS,
    isLoading,
    error: error ? 'hospit.error.rooms' : null,
  };
}

export interface RoomPayload {
  wardId: string;
  code: string;
  labelFr: string;
  roomClass: RoomClass;
  dailyRate: number;
}

export function useCreateRoom() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (payload: RoomPayload) =>
      api.post<RoomView>('/hospitalization/rooms', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-rooms'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { createRoom: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateRoom() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<RoomPayload, 'wardId'> & { active?: boolean } }) =>
      api.put<RoomView>(`/hospitalization/rooms/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-rooms'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { updateRoom: m.mutateAsync, isPending: m.isPending };
}

export function useDeactivateRoom() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/hospitalization/rooms/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-rooms'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { deactivateRoom: m.mutateAsync, isPending: m.isPending };
}

export function useDeleteRoom() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/hospitalization/rooms/${id}/permanent`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-rooms'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { deleteRoom: m.mutateAsync, isPending: m.isPending };
}

// ── Beds ───────────────────────────────────────────────────────────────

export function useBeds() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hosp-beds', { includeInactive: true }],
    queryFn: () =>
      api
        .get<BedView[]>('/hospitalization/beds', { params: { includeInactive: true } })
        .then((r) => r.data),
    staleTime: 30_000,
  });
  return {
    beds: data ?? EMPTY_BEDS,
    isLoading,
    error: error ? 'hospit.error.beds' : null,
  };
}

export function useCreateBed() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (payload: { roomId: string; code: string }) =>
      api.post<BedView>('/hospitalization/beds', payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-beds'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { createBed: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateBed() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { code: string; active?: boolean } }) =>
      api.put<BedView>(`/hospitalization/beds/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-beds'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { updateBed: m.mutateAsync, isPending: m.isPending };
}

export function useUpdateBedStatus() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: ({ id, status }: { id: string; status: ManualBedStatus }) =>
      api.put<BedView>(`/hospitalization/beds/${id}/status`, { status }).then((r) => r.data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-beds'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { updateBedStatus: m.mutateAsync, isPending: m.isPending };
}

export function useDeactivateBed() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/hospitalization/beds/${id}`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-beds'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { deactivateBed: m.mutateAsync, isPending: m.isPending };
}

export function useDeleteBed() {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await api.delete(`/hospitalization/beds/${id}/permanent`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hosp-beds'] });
      void qc.invalidateQueries({ queryKey: ['hosp-board'] });
    },
  });
  return { deleteBed: m.mutateAsync, isPending: m.isPending };
}

// ── Board ──────────────────────────────────────────────────────────────

const EMPTY_BOARD: BedBoard = { wards: [] };

export function useBedBoard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['hosp-board'],
    queryFn: () => api.get<BedBoard>('/hospitalization/board').then((r) => r.data),
    staleTime: 15_000,
  });
  return {
    board: data ?? EMPTY_BOARD,
    isLoading,
    error: error ? 'hospit.error.board' : null,
  };
}
