import { useState } from 'react';
import { api } from '@/lib/api/client';
import type { InvoiceSearchFilters } from '../types';
import { filtersToParams } from './useInvoiceSearch';

/**
 * Triggers a CSV or xlsx download of the current filter set.
 * The auth token is in memory (not in HttpOnly cookie reachable by the browser),
 * so we cannot use a plain {@code <a download>} — we fetch the blob with our axios
 * client (which adds the Bearer header) and pipe it through {@code URL.createObjectURL}.
 */
export function useInvoiceExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportInvoices(filters: InvoiceSearchFilters, format: 'csv' | 'xlsx') {
    setIsExporting(true);
    setError(null);
    try {
      const params = { ...filtersToParams(filters, 0, 0), format };
      // Drop pagination from blob path
      delete (params as Record<string, unknown>).page;
      delete (params as Record<string, unknown>).size;
      const response = await api.get<Blob>('/invoices/export', {
        params,
        // Spring @RequestParam List<> expects ?key=a&key=b, not ?key[]=a&key[]=b.
        paramsSerializer: { indexes: null },
        responseType: 'blob',
      });
      const filename = extractFilename(response.headers['content-disposition'])
        ?? `factures.${format}`;
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: unknown } };
      if (err.response?.status === 422) {
        setError("Trop de résultats à exporter. Affinez vos filtres (max 10 000 factures).");
      } else if (err.response?.status === 403) {
        setError("Export réservé aux médecins et administrateurs.");
      } else {
        setError("Échec de l'export. Réessayez ou contactez le support.");
      }
    } finally {
      setIsExporting(false);
    }
  }

  return { exportInvoices, isExporting, error, clearError: () => setError(null) };
}

function extractFilename(disposition: string | undefined): string | null {
  if (!disposition) return null;
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return match ? match[1] ?? null : null;
}
