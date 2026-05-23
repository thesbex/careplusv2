/**
 * UserAvatar — V052.
 *
 * Rendu cohérent avatar dans le chat : `<img>` si `hasPhoto`, sinon initiales
 * colorées. Sur erreur de chargement (404 race, photo supprimée), on retombe
 * silencieusement sur les initiales — pas de "image cassée".
 *
 * Le binaire est servi par GET /api/users/{id}/photo (V052) en JWT-attached.
 * Pour éviter une 2e couche de fetch+blob (les <img> n'attachent pas le
 * Bearer in-memory), on s'appuie sur le cookie de session + le cache navigateur
 * `cache-control: private, max-age=60` côté serveur. C'est OK pour les avatars
 * qui sont lus en masse.
 */
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

interface UserAvatarProps {
  userId: string;
  hasPhoto: boolean;
  initials: string;
  color: string;
  size: number;
  /** Optional version / cache-buster — bump to re-fetch the photo after upload. */
  version?: number;
}

export function UserAvatar({ userId, hasPhoto, initials, color, size, version = 0 }: UserAvatarProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!hasPhoto) {
      setBlobUrl(null);
      return;
    }
    let cancelled = false;
    let createdUrl: string | null = null;
    api
      .get(`/users/${userId}/photo`, { responseType: 'arraybuffer' })
      .then((res) => {
        if (cancelled) return;
        const ctype = (res.headers['content-type'] as string) ?? 'image/jpeg';
        const blob = new Blob([res.data as ArrayBuffer], { type: ctype });
        createdUrl = URL.createObjectURL(blob);
        setBlobUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [userId, hasPhoto, version]);

  const baseStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 8,
    display: 'grid',
    placeItems: 'center',
    fontSize: Math.round(size * 0.4),
    fontWeight: 700,
    color: 'white',
    background: color,
    overflow: 'hidden',
    flexShrink: 0,
  };

  if (hasPhoto && blobUrl && !failed) {
    return (
      <div style={baseStyle} aria-hidden="true">
        <img
          src={blobUrl}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div style={baseStyle} aria-hidden="true">
      {initials}
    </div>
  );
}
