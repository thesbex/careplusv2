import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

export function useDeleteLeave(practitionerId?: string) {
  const queryClient = useQueryClient();
  const fallbackUserId = useAuthStore((s) => s.user?.id);
  const targetId = practitionerId ?? fallbackUserId;

  const mutation = useMutation({
    mutationFn: (leaveId: string) =>
      api.delete(`/practitioners/${targetId}/leaves/${leaveId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leaves', targetId] });
      void queryClient.invalidateQueries({ queryKey: ['availability-month'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });

  return {
    deleteLeave: mutation.mutateAsync,
    isDeletingId: mutation.isPending ? (mutation.variables as string) : null,
  };
}
