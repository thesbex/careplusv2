/**
 * QA9-10 — Hooks pour le courrier au confrère depuis une consultation.
 *
 * Endpoints (base axios = /api) :
 *   POST /consultations/{consultationId}/confrere-letter   → 201 { documentId }
 *   GET  /consultations/{consultationId}/confrere-letters  → liste documents
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type {
  ConfrereLetterRequest,
  ConfrereLetterResponse,
  ConfrereLetterDocument,
} from '../types';

const EMPTY: ConfrereLetterDocument[] = [];

function lettersKey(consultationId: string) {
  return ['confrere-letters', consultationId] as const;
}

/** GET — liste des courriers confrère générés pour la consultation. */
export function useConfrereLetters(consultationId: string | undefined) {
  const { data, isLoading, error } = useQuery({
    queryKey: lettersKey(consultationId ?? ''),
    queryFn: () =>
      api
        .get<ConfrereLetterDocument[]>(
          `/consultations/${consultationId}/confrere-letters`,
        )
        .then((r) => r.data),
    enabled: !!consultationId,
    staleTime: 30_000,
  });
  return {
    letters: data ?? EMPTY,
    isLoading,
    error: error ? 'Impossible de charger les courriers confrère.' : null,
  };
}

/**
 * POST — génère le PDF du courrier confrère et le rattache au dossier patient
 * (document LETTRE_CONFRERE). Renvoie le documentId pour téléchargement immédiat.
 */
export function useGenerateConfrereLetter(consultationId: string) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (body: ConfrereLetterRequest) =>
      api
        .post<ConfrereLetterResponse>(
          `/consultations/${consultationId}/confrere-letter`,
          body,
        )
        .then((r) => r.data),
    onSuccess: () => {
      // Le courrier généré apparaît dans la liste de la consultation et
      // sous l'onglet Documents du dossier patient.
      void qc.invalidateQueries({ queryKey: lettersKey(consultationId) });
      void qc.invalidateQueries({ queryKey: ['patient-documents'] });
    },
  });
  return { generate: mutation.mutateAsync, isPending: mutation.isPending };
}
