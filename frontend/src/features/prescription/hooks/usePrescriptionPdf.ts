import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

/**
 * Downloads the prescription PDF as an arraybuffer (bearer auth attached by
 * the axios interceptor), converts to a blob URL so an <iframe> can render it
 * without needing cookie-auth on /api/prescriptions/:id/pdf.
 */
export function usePrescriptionPdf(id?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let objectUrl: string | null = null;

    setIsLoading(true);
    setError(null);

    api
      .get<ArrayBuffer>(`/prescriptions/${id}/pdf`, { responseType: 'arraybuffer' })
      .then((r) => {
        if (cancelled) return;
        const blob = new Blob([r.data], { type: 'application/pdf' });
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le PDF.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return { url, isLoading, error };
}
