/**
 * Promotes the current consultation diagnosis ("A · Appréciation") into a
 * patient antécédent (medical history item). Reuses the existing endpoint
 * `POST /api/patients/{patientId}/antecedents` so no backend change is
 * needed — only the trigger surface (button + dialog) is new.
 *
 * Invalidates the patient cache so the dossier patient's "Antécédents"
 * section reflects the new entry immediately, even if the doctor leaves
 * the consultation and pops back into the dossier.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { AxiosError } from 'axios';

export type AntecedentType =
  | 'MEDICAL'
  | 'CHIRURGICAL'
  | 'FAMILIAL'
  | 'GYNECO_OBSTETRIQUE'
  | 'HABITUS';

/** Mirror of {@code AntecedentCategory.java} (ADR-023, V006). */
export type AntecedentCategory =
  | 'PERSONNEL_MALADIES_CHRONIQUES'
  | 'PERSONNEL_MALADIES_PASSEES'
  | 'PERSONNEL_CHIRURGIES'
  | 'PERSONNEL_HOSPITALISATIONS'
  | 'PERSONNEL_TRAUMATISMES'
  | 'PERSONNEL_ALLERGIES'
  | 'FAMILIAL'
  | 'MEDICAMENTEUX_EN_COURS'
  | 'MEDICAMENTEUX_PASSES'
  | 'MEDICAMENTEUX_AUTOMEDICATION'
  | 'SOCIAL_TABAC'
  | 'SOCIAL_ALCOOL'
  | 'SOCIAL_DROGUES'
  | 'SOCIAL_ACTIVITE_PHYSIQUE'
  | 'SOCIAL_PROFESSION'
  | 'GYNECO_OBSTETRICAL'
  | 'PSYCHIATRIQUE';

export interface PromoteDiagnosisPayload {
  patientId: string;
  type: AntecedentType;
  description: string;
  /** ISO date `YYYY-MM-DD`. Null = blank server-side. */
  occurredOn: string | null;
  category: AntecedentCategory | null;
}

export function usePromoteDiagnosis() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: PromoteDiagnosisPayload): Promise<{ id: string }> => {
      const body: Record<string, unknown> = {
        type: payload.type,
        description: payload.description,
      };
      if (payload.occurredOn) body.occurredOn = payload.occurredOn;
      if (payload.category) body.category = payload.category;
      const res = await api.post<{ id: string }>(
        `/patients/${payload.patientId}/antecedents`,
        body,
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      // Le dossier patient (DossierPage) écoute ['patient', id] et ['patients'].
      void queryClient.invalidateQueries({ queryKey: ['patient', vars.patientId] });
      void queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  return {
    promote: (payload: PromoteDiagnosisPayload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error as AxiosError | null,
  };
}
