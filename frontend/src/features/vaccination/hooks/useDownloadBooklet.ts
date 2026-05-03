import { useState } from 'react';
import { api } from '@/lib/api/client';

/**
 * Downloads the vaccination booklet PDF as a blob and opens it in a new tab.
 * GET /api/patients/:patientId/vaccinations/booklet
 *
 * ADR-019: JWT is in memory, so a direct <a href> would fail auth.
 * We fetch via axios (interceptor attaches Bearer), create a blob URL, then window.open.
 * Pattern identical to CertificatDialog / PrescriptionDrawer.handlePdfDownload.
 */
export function useDownloadBooklet(patientId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(): Promise<void> {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<ArrayBuffer>(
        `/patients/${patientId}/vaccinations/booklet`,
        { responseType: 'arraybuffer' },
      );
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      // Revoke after a short delay to allow the new tab to load
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setError('Impossible de télécharger le carnet. Réessayez.');
    } finally {
      setIsLoading(false);
    }
  }

  return { download, isLoading, error };
}
