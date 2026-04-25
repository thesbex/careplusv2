import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { api } from '@/lib/api/client';
import type {
  PrescriptionApi,
  PrescriptionLineDraft,
  PrescriptionType,
  AllergyConflict,
} from '../types';

interface CreatePrescriptionPayload {
  consultationId: string;
  type: PrescriptionType;
  lines: PrescriptionLineDraft[];
  allergyOverride?: boolean;
  allergyOverrideReason?: string;
}

interface AllergyConflictBody {
  type?: string;
  title?: string;
  medication?: string;
  allergy?: string;
  status?: number;
}

export class AllergyConflictError extends Error {
  readonly medication: string;
  readonly allergy: string;
  constructor(conflict: AllergyConflict) {
    super(`Conflit allergique : ${conflict.medication} / ${conflict.allergy}`);
    this.medication = conflict.medication;
    this.allergy = conflict.allergy;
  }
}

function linesToApi(type: PrescriptionType, lines: PrescriptionLineDraft[]) {
  return lines
    .filter((l) => l.item !== null || l.dosage.length > 0 || l.instructions.length > 0)
    .map((l) => {
      const id = l.item?.id ?? null;
      return {
        medicationId: type === 'DRUG' ? id : null,
        labTestId: type === 'LAB' ? id : null,
        imagingExamId: type === 'IMAGING' ? id : null,
        freeText: l.item ? null : (l.instructions.trim() ? l.instructions : null),
        dosage: l.dosage ? l.dosage : null,
        frequency: l.frequency || null,
        duration: l.duration || null,
        route: null,
        timing: null,
        quantity: l.quantity,
        instructions: l.instructions || null,
      };
    });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (payload: CreatePrescriptionPayload): Promise<PrescriptionApi> => {
      try {
        const res = await api.post<PrescriptionApi>(
          `/consultations/${payload.consultationId}/prescriptions`,
          {
            type: payload.type,
            lines: linesToApi(payload.type, payload.lines),
            allergyOverride: payload.allergyOverride ?? false,
            allergyOverrideReason: payload.allergyOverrideReason ?? null,
          },
        );
        return res.data;
      } catch (err) {
        if (err instanceof AxiosError && err.response?.status === 422) {
          const body = err.response.data as AllergyConflictBody;
          if (body.medication && body.allergy) {
            throw new AllergyConflictError({
              medication: body.medication,
              allergy: body.allergy,
            });
          }
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({
        queryKey: ['prescriptions', data.consultationId],
      });
    },
  });

  return {
    createPrescription: (payload: CreatePrescriptionPayload) => mutation.mutateAsync(payload),
    isPending: mutation.isPending,
    error: mutation.error,
  };
}
