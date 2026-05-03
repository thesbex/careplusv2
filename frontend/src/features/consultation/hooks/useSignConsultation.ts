/**
 * Hook for signing/locking a consultation.
 *
 * Currently a mock that logs the action.
 * TODO(backend:J5): replace with:
 *   useMutation({ mutationFn: (id) => api.post(`/api/consultations/${id}/sign`) })
 */
import { useState } from 'react';

export function useSignConsultation() {
  const [isSigning, setIsSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  function sign(_id?: string) {
    setIsSigning(true);
    // TODO(backend:J5): POST /api/consultations/:id/sign
    console.log('[useSignConsultation] mock sign for', _id);
    setTimeout(() => {
      setIsSigning(false);
      setSigned(true);
    }, 400);
  }

  return { sign, isSigning, signed };
}
