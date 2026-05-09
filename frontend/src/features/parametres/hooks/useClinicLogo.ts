/**
 * V037 — gestion du logo établissement (cabinet-wide, pas per-médecin).
 *
 * - GET  /api/settings/clinic/logo/meta : métadonnées (mime + date + taille)
 * - GET  /api/settings/clinic/logo      : bytes bruts (pour aperçu)
 * - PUT  /api/settings/clinic/logo      : upload multipart (ADMIN seul)
 * - DELETE /api/settings/clinic/logo    : suppression (ADMIN seul)
 *
 * Pattern aligné sur useSignature.ts : queries séparées meta vs preview pour
 * ne pas tirer les bytes tant qu'on n'a pas besoin de les afficher.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export interface LogoMeta {
  mime: string;
  uploadedAt: string;
  sizeBytes: number;
}

const META_KEY = 'clinic-logo-meta';
const PREVIEW_KEY = 'clinic-logo-preview';

export function useClinicLogoMeta() {
  const { data, isLoading } = useQuery({
    queryKey: [META_KEY],
    queryFn: () =>
      api
        .get<LogoMeta>('/settings/clinic/logo/meta')
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
export function useClinicLogoPreviewUrl(meta: LogoMeta | null) {
  const { data } = useQuery({
    queryKey: [PREVIEW_KEY, meta?.uploadedAt ?? null],
    enabled: !!meta,
    queryFn: async () => {
      const res = await api.get<Blob>('/settings/clinic/logo', {
        responseType: 'blob',
      });
      if (res.status === 204) return null;
      return URL.createObjectURL(res.data);
    },
    staleTime: Infinity,
  });
  return data ?? null;
}

export function useUploadClinicLogo() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      const r = await api.put<LogoMeta>('/settings/clinic/logo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return r.data;
    },
    onSuccess: (meta) => {
      qc.setQueryData([META_KEY], meta);
      void qc.invalidateQueries({ queryKey: [PREVIEW_KEY] });
      // Aussi rafraîchir clinic-settings (hasLogo a changé)
      void qc.invalidateQueries({ queryKey: ['clinic-settings'] });
    },
  });
  return { upload: mutation.mutateAsync, isPending: mutation.isPending };
}

export function useDeleteClinicLogo() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      api.delete('/settings/clinic/logo').then(() => undefined),
    onSuccess: () => {
      qc.setQueryData([META_KEY], null);
      void qc.invalidateQueries({ queryKey: [PREVIEW_KEY] });
      void qc.invalidateQueries({ queryKey: ['clinic-settings'] });
    },
  });
  return { remove: mutation.mutateAsync, isPending: mutation.isPending };
}
