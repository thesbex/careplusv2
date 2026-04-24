import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type AllergySeverity = 'LEGERE' | 'MODEREE' | 'SEVERE';
export type AntecedentType =
  | 'MEDICAL'
  | 'CHIRURGICAL'
  | 'FAMILIAL'
  | 'GYNECO_OBSTETRIQUE'
  | 'HABITUS';

export interface ExistingAllergy {
  id: string;
  substance: string;
  severity: AllergySeverity;
}

export interface ExistingAntecedent {
  id: string;
  type: AntecedentType;
  description: string;
}

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
  // Allergies
  existingAllergies: ExistingAllergy[];   // kept as-is
  deletedAllergyIds: string[];            // will DELETE
  newAllergies: { substance: string; severity: AllergySeverity }[]; // will POST
  // Antécédents
  existingAntecedents: ExistingAntecedent[]; // kept as-is
  deletedAntecedentIds: string[];             // will DELETE
  newAntecedents: { type: AntecedentType; description: string }[];  // will POST
}

export function useUpdatePatient(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (form: UpdatePatientForm) => {
      // 1. Update basic info
      await api.put(`/patients/${id}`, {
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
      });

      // 2. Delete removed allergies
      await Promise.all(
        form.deletedAllergyIds.map((aid) =>
          api.delete(`/patients/${id}/allergies/${aid}`)
        )
      );

      // 3. Add new allergies
      await Promise.all(
        form.newAllergies
          .filter((a) => a.substance.trim())
          .map((a) =>
            api.post(`/patients/${id}/allergies`, {
              substance: a.substance.trim(),
              severity: a.severity,
            })
          )
      );

      // 4. Delete removed antécédents
      await Promise.all(
        form.deletedAntecedentIds.map((aid) =>
          api.delete(`/patients/${id}/antecedents/${aid}`)
        )
      );

      // 5. Add new antécédents
      await Promise.all(
        form.newAntecedents
          .filter((a) => a.description.trim())
          .map((a) =>
            api.post(`/patients/${id}/antecedents`, {
              type: a.type,
              description: a.description.trim(),
            })
          )
      );
    },
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
