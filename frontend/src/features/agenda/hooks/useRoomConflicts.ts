/**
 * useRoomConflicts — fetches overlapping appointments in the same room
 * for a given appointment id.
 *
 * Backend contract (Wave 1, commit e3a7a76):
 *   GET /api/appointments/{id}/room-conflicts
 *   → 200 OK with [] when no conflict (or no roomId on the appointment).
 *   → returns warnings only, never blocks the caller.
 *
 * Hook is disabled by default — caller passes `enabled: !!appointmentId
 * && !!roomId` so we don't query for appointments that have no room
 * assigned. The roomId is part of the input only for cache invalidation
 * + the enabled gate; the endpoint reads the room from the persisted
 * appointment.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface RoomConflictView {
  conflictAppointmentId: string;
  conflictPatientLastName: string;
  conflictPatientFirstName: string;
  conflictStartAt: string;
  conflictEndAt: string;
  conflictPractitionerId: string;
  conflictPractitionerLastName: string;
  conflictPractitionerFirstName: string;
}

export function useRoomConflicts(params: {
  appointmentId: string | null | undefined;
  roomId: string | null | undefined;
}): {
  data: RoomConflictView[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const { appointmentId, roomId } = params;
  const enabled = !!appointmentId && !!roomId;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['room-conflicts', appointmentId, roomId],
    queryFn: () =>
      api
        .get<RoomConflictView[]>(`/appointments/${appointmentId}/room-conflicts`)
        .then((r) => r.data),
    enabled,
    staleTime: 0, // a freshly-saved RDV must surface conflicts immediately
    refetchOnWindowFocus: false,
  });

  return {
    data: data ?? [],
    isLoading,
    isError,
    refetch: () => {
      void refetch();
    },
  };
}
