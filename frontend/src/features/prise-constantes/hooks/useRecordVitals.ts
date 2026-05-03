/**
 * useRecordVitals — mock submission hook for Prise des constantes (screen 05).
 *
 * TODO(backend:J5): swap to useMutation POSTing
 *   POST /api/appointments/:appointmentId/vitals
 * once the J5 vitals module ships.
 * The VitalsFormValues type already mirrors the expected backend DTO shape,
 * so the swap will be structural only (replace the setTimeout mock with
 * the axios call through the JWT-interceptor client).
 */
import { useState } from 'react';
import type { UseRecordVitalsResult } from '../types';
import type { VitalsFormValues } from '../schema';

export function useRecordVitals(): UseRecordVitalsResult {
  const [isPending, setIsPending] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(_values: VitalsFormValues): Promise<void> {
    setIsPending(true);
    setError(null);
    try {
      // Simulate async network round-trip
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
      setIsSuccess(true);
    } catch {
      setError('Erreur lors de l\'enregistrement. Réessayez.');
    } finally {
      setIsPending(false);
    }
  }

  return { submit, isPending, isSuccess, error };
}
