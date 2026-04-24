import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface CreatePatientForm {
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

interface CreatedPatient {
  id: string;
  firstName: string;
  lastName: string;
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (form: CreatePatientForm) =>
      api
        .post<CreatedPatient>('/patients', {
          firstName: form.firstName,
          lastName: form.lastName,
          gender: form.gender,
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
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  return {
    create: mutation.mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error
      ? (mutation.error as { response?: { data?: { message?: string } } })
          .response?.data?.message ?? 'Erreur lors de la création.'
      : null,
    reset: mutation.reset,
  };
}
