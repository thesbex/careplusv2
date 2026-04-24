import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface UpdatePatientForm {
  firstName: string;
  lastName: string;
  gender: 'M' | 'F' | 'O';
  birthDate: string;
  cin: string;
  phone: string;
  email: string;
  city: string;
  bloodGroup: string;
  notes: string;
}

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (form: UpdatePatientForm) =>
      api
        .put(`/patients/${id}`, {
          firstName: form.firstName || null,
          lastName: form.lastName || null,
          gender: form.gender || null,
          birthDate: form.birthDate || null,
          cin: form.cin || null,
          phone: form.phone || null,
          email: form.email || null,
          city: form.city || null,
          bloodGroup: form.bloodGroup || null,
          notes: form.notes || null,
        })
        .then((r) => r.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['patient', id] });
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  return {
    update: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error
      ? (mutation.error as { response?: { data?: { message?: string } } })
          .response?.data?.message ?? 'Erreur lors de la modification.'
      : null,
    reset: mutation.reset,
  };
}
