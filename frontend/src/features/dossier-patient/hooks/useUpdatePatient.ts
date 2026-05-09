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

export type PatientTier = 'NORMAL' | 'PREMIUM';

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
  // Tier (NORMAL/PREMIUM) + mutuelle — sent via dedicated PUT endpoints
  // (PUT /patients/:id/tier + /mutuelle), separate from the basic PUT.
  tier: PatientTier;
  hasMutuelle: boolean;
  mutuelleInsuranceId: string;
  mutuellePolicyNumber: string;
  // Snapshot of the values when the form was opened — used to skip the
  // dedicated tier/mutuelle PUTs when nothing changed (useful because
  // /mutuelle is gated by the tier-update permission set on a few backends).
  initialTier: PatientTier;
  initialHasMutuelle: boolean;
  initialMutuelleInsuranceId: string;
  initialMutuellePolicyNumber: string;
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

      // 1b. Tier — dedicated endpoint, only call when changed (PUT
      // /patients/:id/tier requires MEDECIN/ADMIN; secrétaires éditant une
      // fiche sans toucher au tier doivent pouvoir sauver sans 403).
      if (form.tier !== form.initialTier) {
        await api.put(`/patients/${id}/tier`, { tier: form.tier });
      }

      // 1c. Mutuelle — dedicated endpoint. Even when "a une mutuelle" is
      // unchecked we PUT once with insuranceId=null to clear server-side.
      const mutuelleChanged =
        form.hasMutuelle !== form.initialHasMutuelle ||
        form.mutuelleInsuranceId !== form.initialMutuelleInsuranceId ||
        form.mutuellePolicyNumber !== form.initialMutuellePolicyNumber;
      if (mutuelleChanged) {
        await api.put(`/patients/${id}/mutuelle`, {
          insuranceId: form.hasMutuelle ? form.mutuelleInsuranceId || null : null,
          policyNumber: form.hasMutuelle ? form.mutuellePolicyNumber || null : null,
        });
      }

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
