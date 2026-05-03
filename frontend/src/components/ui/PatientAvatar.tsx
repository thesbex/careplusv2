/**
 * PatientAvatar — affiche la photo patient (QA5-3) si présente, fallback sur
 * les initiales.
 *
 * Le JWT vivant en mémoire (ADR-019), un `<img src="/api/.../content">`
 * direct ne porterait pas l'`Authorization` header. On charge donc le binaire
 * via React Query (cache déduplication par documentId) et on rend le résultat
 * comme `data:` URL ou ObjectURL.
 *
 * - `documentId` absent → fallback initiales (comportement v1).
 * - `documentId` présent → fetch async ; pendant le chargement on garde les
 *   initiales pour éviter le flicker, l'image les remplace au succès.
 * - Sur 410/404 (fichier disparu) → fallback initiales silencieux.
 */
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';

export type PatientAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface PatientAvatarProps {
  initials: string;
  documentId?: string | null;
  size?: PatientAvatarSize;
  className?: string;
  style?: React.CSSProperties;
  /** Force la couleur de fond du fallback initiales. */
  bg?: string;
}

const SIZE_CLASS: Record<PatientAvatarSize, string> = {
  sm: 'sm',
  md: '',
  lg: 'lg',
  xl: 'lg',
};

const SIZE_PX: Record<PatientAvatarSize, number> = {
  sm: 28,
  md: 36,
  lg: 56,
  xl: 80,
};

interface PreviewPayload {
  mimeType: string;
  filename: string;
  sizeBytes: number;
  base64: string;
}

function usePatientPhoto(documentId: string | null | undefined) {
  return useQuery({
    queryKey: ['patient-photo', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const { data } = await api.get<PreviewPayload>(`/documents/${documentId}/preview`);
      return `data:${data.mimeType};base64,${data.base64}`;
    },
    enabled: !!documentId,
    // La photo change rarement et l'URL reste stable tant que documentId ne
    // change pas — on peut garder un cache long.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
  });
}

export function PatientAvatar({
  initials,
  documentId,
  size = 'md',
  className,
  style,
  bg,
}: PatientAvatarProps) {
  const px = SIZE_PX[size];
  const { data: src } = usePatientPhoto(documentId ?? null);
  const trimmed = initials.slice(0, 2).toUpperCase();
  const baseClass = ['cp-avatar', SIZE_CLASS[size], className].filter(Boolean).join(' ');

  // Re-render-safe error state : si l'image échoue, on bascule sur initiales.
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [src]);

  if (src && !imgFailed) {
    return (
      <div
        className={baseClass}
        aria-hidden="true"
        style={{
          width: px,
          height: px,
          padding: 0,
          background: 'transparent',
          ...style,
        }}
      >
        <img
          src={src}
          alt=""
          onError={() => setImgFailed(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '50%',
            display: 'block',
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={baseClass}
      aria-hidden="true"
      style={{
        width: px,
        height: px,
        background: bg ?? 'var(--primary)',
        ...style,
      }}
    >
      {trimmed}
    </div>
  );
}
