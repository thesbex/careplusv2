import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';

export function useDeleteLeave() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((s) => s.user?.id);

  const mutation = useMutation({
    mutationFn: (leaveId: string) =>
      api.delete(`/practitioners/${userId}/leaves/${leaveId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leaves', userId] });
      void queryClient.invalidateQueries({ queryKey: ['availability-month'] });
      void queryClient.invalidateQueries({ queryKey: ['availability'] });
    },
  });

  return {
    deleteLeave: mutation.mutateAsync,
    isDeletingId: mutation.isPending ? (mutation.variables as string) : null,
  };
}
