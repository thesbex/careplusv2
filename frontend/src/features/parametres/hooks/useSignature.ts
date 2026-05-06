/**
 * F16 — gestion de la signature scannée du médecin (Paramétrage cabinet).
 *
 * - GET  /api/settings/signature/meta : métadonnées (mime + date + taille)
 * - PUT  /api/settings/signature       : upload multipart, ADMIN seul
 * - DELETE /api/settings/signature     : suppression, ADMIN seul
 *
 * L'aperçu visuel utilise l'URL `/api/settings/signature` (Authorization
 * header attaché par axios via interceptor) chargée comme blob via fetch
 * pour pouvoir mettre la balise <img src=".."> avec un objectURL.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface SignatureMeta {
  mime: string;
  uploadedAt: string;
  sizeBytes: number;
}

export const SIGNATURE_QUERY_KEY = ['cabinet-signature-meta'] as const;
export const SIGNATURE_PREVIEW_KEY = ['cabinet-signature-preview'] as const;

export function useSignatureMeta() {
  const { data, isLoading } = useQuery({
    queryKey: SIGNATURE_QUERY_KEY,
    queryFn: () =>
      api
        .get<SignatureMeta>('/settings/signature/meta')
        .then((r) => (r.status === 204 ? null : r.data))
        .catch(() => null),
    staleTime: 30_000,
  });
  return { meta: data ?? null, isLoading };
}

/**
 * Récupère les bytes en blob et renvoie un object URL utilisable dans `<img src>`.
 * Re-fetch à chaque changement de meta (cache-busting via uploadedAt).
 */
export function useSignaturePreviewUrl(meta: SignatureMeta | null) {
  const { data } = useQuery({
    queryKey: [...SIGNATURE_PREVIEW_KEY, meta?.uploadedAt ?? null],
    enabled: !!meta,
    queryFn: async () => {
      const res = await api.get<Blob>('/settings/signature', { responseType: 'blob' });
      if (res.status === 204) return null;
      return URL.createObjectURL(res.data);
    },
    staleTime: Infinity,
  });
  return data ?? null;
}

export function useUploadSignature() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.put<SignatureMeta>('/settings/signature', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: (meta) => {
      qc.setQueryData(SIGNATURE_QUERY_KEY, meta);
      // Force the preview blob to be re-fetched on next render.
      void qc.invalidateQueries({ queryKey: SIGNATURE_PREVIEW_KEY });
    },
  });
  return { upload: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteSignature() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => api.delete('/settings/signature').then(() => undefined),
    onSuccess: () => {
      qc.setQueryData(SIGNATURE_QUERY_KEY, null);
      void qc.invalidateQueries({ queryKey: SIGNATURE_PREVIEW_KEY });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}
