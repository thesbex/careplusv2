/**
 * V037 — section "Logo de l'établissement" (paramétrage cabinet, ADMIN seul).
 *
 * Le logo est injecté en haut à gauche de tous les PDFs générés (ordonnance,
 * certificat, bon d'analyses/imagerie, carnet vaccination). Si pas de logo
 * configuré, le rendu actuel (texte seul) reste inchangé.
 *
 * Workflow identique à SignatureSettingsSection :
 *   1. Aperçu du logo actuel ou message "Aucun logo".
 *   2. "Téléverser" → input file caché → upload immédiat.
 *   3. "Supprimer" si un logo existe (confirm natif).
 *
 * Validation côté frontend = double sécurité du backend (mêmes règles) :
 *   - MIME ∈ {image/png, image/jpeg}   (pas de WEBP/SVG en v1, cf. design doc)
 *   - taille ≤ 500 Ko
 */
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import {
  useClinicLogoMeta,
  useClinicLogoPreviewUrl,
  useUploadClinicLogo,
  useDeleteClinicLogo,
  useUpdateLogoPosition,
  type LogoPosition,
} from '../hooks/useClinicLogo';
import { useT } from '@/lib/i18n/I18nProvider';

const MAX_BYTES = 500 * 1024;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg']);
const ACCEPT_ATTR = '.png,.jpg,.jpeg';

export function LogoSettingsSection() {
  const { t } = useT();
  const POSITION_OPTIONS: { value: LogoPosition; label: string; hint: string }[] = [
    { value: 'HEADER', label: t('settings.logo.pos.header'), hint: t('settings.logo.pos.headerHint') },
    { value: 'FOOTER', label: t('settings.logo.pos.footer'), hint: t('settings.logo.pos.footerHint') },
    { value: 'WATERMARK', label: t('settings.logo.pos.watermark'), hint: t('settings.logo.pos.watermarkHint') },
    { value: 'NONE', label: t('settings.logo.pos.none'), hint: t('settings.logo.pos.noneHint') },
  ];
  const { meta, isLoading } = useClinicLogoMeta();
  const previewUrl = useClinicLogoPreviewUrl(meta);
  const { upload, isPending: isUploading } = useUploadClinicLogo();
  const { remove, isPending: isDeleting } = useDeleteClinicLogo();
  const { updatePosition, isPending: isUpdatingPos } = useUpdateLogoPosition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Default to HEADER until the meta load lands so the selector renders even
  // before the very first upload (the BE may not yet have a settings row).
  const currentPosition: LogoPosition = meta?.position ?? 'HEADER';

  async function handlePositionChange(next: LogoPosition) {
    if (next === currentPosition) return;
    try {
      await updatePosition(next);
      toast.success(t('settings.logo.posUpdated'));
    } catch {
      toast.error(t('settings.logo.posErr'));
    }
  }

  function handlePick() {
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    if (!ALLOWED_MIMES.has(file.type)) {
      setErrorMsg(t('settings.logo.badFormat'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrorMsg(t('settings.logo.tooBig'));
      return;
    }
    try {
      await upload(file);
      toast.success(t('settings.logo.updated'));
    } catch {
      toast.error(t('settings.logo.uploadErr'));
    }
  }

  async function handleRemove() {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('settings.logo.confirmRemove'))) return;
    try {
      await remove();
      toast.success(t('settings.logo.removed'));
    } catch {
      toast.error(t('settings.logo.removeErr'));
    }
  }

  const hasLogo = !!meta;

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHeader>{t('settings.logo.title')}</PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          {t('settings.logo.hint')}
          <br />
          {t('settings.logo.hint2')}
        </div>

        <div
          data-testid="logo-preview"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 110,
            padding: 14,
            background: 'var(--surface-2)',
            border: '1px dashed var(--border)',
            borderRadius: 6,
          }}
        >
          {isLoading && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('common.loading')}</span>
          )}
          {!isLoading && hasLogo && previewUrl && (
            <img
              src={previewUrl}
              alt="Logo configuré"
              style={{ maxWidth: 240, maxHeight: 90, objectFit: 'contain' }}
            />
          )}
          {!isLoading && hasLogo && !previewUrl && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t('common.loading')}</span>
          )}
          {!isLoading && !hasLogo && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {t('settings.logo.none')}
            </span>
          )}
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{errorMsg}</div>
        )}

        {meta && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {t('settings.fileMeta', { mime: meta.mime, size: (meta.sizeBytes / 1024).toFixed(1) })}
          </div>
        )}

        {/* V043 — emplacement du logo sur les PDFs. Toujours visible (même
            avant le premier upload) pour que l'admin pré-règle la position. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
            {t('settings.logo.placement')}
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {POSITION_OPTIONS.map((opt) => {
              const active = opt.value === currentPosition;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={isUpdatingPos}
                  onClick={() => { void handlePositionChange(opt.value); }}
                  aria-pressed={active}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 6,
                    border: active
                      ? '1px solid var(--primary)'
                      : '1px solid var(--border)',
                    background: active ? 'var(--primary-soft, #eff6ff)' : 'var(--surface)',
                    cursor: isUpdatingPos ? 'wait' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: active ? 'var(--primary)' : 'var(--ink-1)',
                  }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                    {opt.hint}
                  </div>
                </button>
              );
            })}
          </div>
        </div>


        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={(e) => {
            void handleFile(e);
          }}
          style={{ display: 'none' }}
          data-testid="logo-file-input"
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {hasLogo && (
            <Button
              variant="ghost"
              disabled={isDeleting || isUploading}
              onClick={() => {
                void handleRemove();
              }}
            >
              {isDeleting ? t('common.deleting') : t('common.delete')}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={isUploading || isDeleting}
            onClick={handlePick}
          >
            {isUploading
              ? t('settings.logo.uploading')
              : hasLogo
                ? t('settings.logo.replace')
                : t('settings.logo.upload')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
