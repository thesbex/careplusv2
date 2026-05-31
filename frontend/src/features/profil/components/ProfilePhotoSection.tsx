/**
 * Photo de profil de l'utilisateur (V052).
 *
 * - Affiche la photo courante (GET /api/users/{me}/photo) — 404 → fallback initiales.
 * - Upload via PUT /api/me/photo (multipart). Max 2 Mo, JPEG/PNG/WebP/HEIC.
 * - Suppression via DELETE /api/me/photo.
 * - Sert d'avatar dans le chat (cf. hasPhoto sur TeamMemberView / ColleagueView).
 */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif';
const MAX_BYTES = 2 * 1024 * 1024;

function initials(first?: string | null, last?: string | null) {
  return ((first?.[0] ?? '') + (last?.[0] ?? '')).toUpperCase();
}

export function ProfilePhotoSection() {
  const { t } = useT();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bust the avatar cache when we (re)upload — both for the local preview and
  // the chat / team views that compose /api/users/{id}/photo.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let createdUrl: string | null = null;
    api
      .get(`/users/${userId}/photo`, { responseType: 'arraybuffer' })
      .then((res) => {
        if (cancelled) return;
        const ctype = (res.headers['content-type'] as string) ?? 'image/jpeg';
        const blob = new Blob([res.data as ArrayBuffer], { type: ctype });
        createdUrl = URL.createObjectURL(blob);
        setPhotoUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setPhotoUrl(null);
      });
    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [userId, version]);

  async function onFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error(t('profil.photo.tooLarge'));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.put('/me/photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('profil.photo.updated'));
      setVersion((v) => v + 1);
    } catch (err) {
      const status =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 415) {
        toast.error(t('profil.photo.unsupported'), {
          description: t('profil.photo.unsupportedDesc'),
        });
      } else if (status === 413) {
        toast.error(t('profil.photo.tooLarge'));
      } else {
        toast.error(t('profil.photo.uploadFailed'));
      }
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await api.delete('/me/photo');
      toast.success(t('profil.photo.removed'));
      setVersion((v) => v + 1);
    } catch {
      toast.error(t('profil.photo.removeFailed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)',
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 14 }}>{t('profil.photo.title')}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        {t('profil.photo.hint')}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          aria-hidden="true"
          style={{
            width: 84,
            height: 84,
            borderRadius: 8,
            background: photoUrl ? 'transparent' : 'var(--primary-soft, #e7ebff)',
            color: 'var(--primary, #2563eb)',
            display: 'grid',
            placeItems: 'center',
            fontSize: 26,
            fontWeight: 700,
            overflow: 'hidden',
            border: '1px solid var(--border)',
          }}
        >
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={t('profil.photo.alt')}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            initials(user?.firstName, user?.lastName) || '?'
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void onFile(f);
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {photoUrl ? t('profil.photo.replace') : t('profil.photo.upload')}
          </Button>
          {photoUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void onDelete()}
            >
              {t('profil.photo.remove')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
