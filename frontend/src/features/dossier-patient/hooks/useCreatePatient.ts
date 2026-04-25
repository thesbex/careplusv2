import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type AllergySeverity = 'LEGERE' | 'MODEREE' | 'SEVERE';
export type AntecedentType =
  | 'MEDICAL'
  | 'CHIRURGICAL'
  | 'FAMILIAL'
  | 'GYNECO_OBSTETRIQUE'
  | 'HABITUS';

export interface AllergyEntry {
  substance: string;
  severity: AllergySeverity;
}

export interface AntecedentEntry {
  type: AntecedentType;
  description: string;
}

export type PatientTier = 'NORMAL' | 'PREMIUM';

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
  tier: PatientTier;
  hasMutuelle: boolean;
  mutuelleInsuranceId: string;
  mutuellePolicyNumber: string;
  allergies: AllergyEntry[];
  antecedents: AntecedentEntry[];
}

interface CreatedPatient {
  id: string;
  firstName: string;
  lastName: string;
}

export function useCreatePatient() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (form: CreatePatientForm) => {
      const { data: patient } = await api.post<CreatedPatient>('/patients', {
        firstName: form.firstName,
        lastName: form.lastName,
        gender: form.gender,
        birthDate: form.birthDate || null,
        cin: form.cin || null,
        phone: form.phone,
        email: form.email || null,
        city: form.city || null,
        bloodGroup: form.bloodGroup || null,
        notes: form.notes || null,
        tier: form.tier,
        mutuelleInsuranceId: form.hasMutuelle ? form.mutuelleInsuranceId || null : null,
        mutuellePolicyNumber: form.hasMutuelle ? form.mutuellePolicyNumber || null : null,
      });

      for (const allergy of form.allergies) {
        if (allergy.substance.trim()) {
          await api.post(`/patients/${patient.id}/allergies`, {
            substance: allergy.substance.trim(),
            severity: allergy.severity,
          });
        }
      }

      for (const ant of form.antecedents) {
        if (ant.description.trim()) {
          await api.post(`/patients/${patient.id}/antecedents`, {
            type: ant.type,
            description: ant.description.trim(),
          });
        }
      }

      return patient;
    },
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
