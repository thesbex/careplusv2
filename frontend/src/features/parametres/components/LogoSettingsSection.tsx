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

const POSITION_OPTIONS: { value: LogoPosition; label: string; hint: string }[] = [
  { value: 'HEADER', label: 'En-tête', hint: 'En haut à gauche du document (défaut)' },
  { value: 'FOOTER', label: 'Pied de page', hint: 'En bas du document, au-dessus de la mention CarePlus' },
  { value: 'WATERMARK', label: 'Fond de page (filigrane)', hint: 'Centré sur la page, transparent (~8 %), derrière le contenu' },
  { value: 'NONE', label: 'Aucun', hint: 'Ne pas afficher le logo sur les documents' },
];

const MAX_BYTES = 500 * 1024;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg']);
const ACCEPT_ATTR = '.png,.jpg,.jpeg';

export function LogoSettingsSection() {
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
      toast.success('Emplacement du logo mis à jour.');
    } catch {
      toast.error('Échec de la mise à jour de l\'emplacement.');
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
      setErrorMsg('Format non autorisé. Utiliser PNG ou JPEG.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrorMsg('Image trop volumineuse (max 500 Ko).');
      return;
    }
    try {
      await upload(file);
      toast.success('Logo mis à jour.');
    } catch {
      toast.error('Échec du téléversement du logo.');
    }
  }

  async function handleRemove() {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Supprimer le logo configuré ?')) return;
    try {
      await remove();
      toast.success('Logo supprimé.');
    } catch {
      toast.error('Échec de la suppression.');
    }
  }

  const hasLogo = !!meta;

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHeader>Logo de l'établissement (auto-injecté sur les PDFs)</PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          Le logo apparaît en haut à gauche de chaque ordonnance, certificat,
          bon d'analyses, bon d'imagerie et carnet de vaccination généré.
          <br />
          PNG ou JPEG, max 500 Ko. Idéalement format paysage (~200×80&nbsp;px),
          fond transparent recommandé pour PNG.
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
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Chargement…</span>
          )}
          {!isLoading && hasLogo && previewUrl && (
            <img
              src={previewUrl}
              alt="Logo configuré"
              style={{ maxWidth: 240, maxHeight: 90, objectFit: 'contain' }}
            />
          )}
          {!isLoading && hasLogo && !previewUrl && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Chargement de l'aperçu…</span>
          )}
          {!isLoading && !hasLogo && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Aucun logo configuré — les PDF afficheront le nom en texte seul.
            </span>
          )}
        </div>

        {errorMsg && (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{errorMsg}</div>
        )}

        {meta && (
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            Format : {meta.mime} · Taille : {(meta.sizeBytes / 1024).toFixed(1)} Ko
          </div>
        )}

        {/* V043 — emplacement du logo sur les PDFs. Toujours visible (même
            avant le premier upload) pour que l'admin pré-règle la position. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
            Emplacement du logo sur les documents
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
              {isDeleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          )}
          <Button
            variant="primary"
            disabled={isUploading || isDeleting}
            onClick={handlePick}
          >
            {isUploading
              ? 'Téléversement…'
              : hasLogo
                ? 'Remplacer le logo'
                : 'Téléverser un logo'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
