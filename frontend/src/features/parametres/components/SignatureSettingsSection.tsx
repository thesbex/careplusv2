/**
 * F16 — section "Signature médecin" du paramétrage cabinet (onglet Cabinet).
 *
 * Affichée uniquement si l'utilisateur courant a le rôle ADMIN. Le médecin
 * pilote a souvent ADMIN+MEDECIN, mais MEDECIN seul ne suffit pas (cohérent
 * avec les autres réglages cabinet — V016, V018, etc.).
 *
 * Workflow :
 *   1. Aperçu de la signature actuelle (ou message vide).
 *   2. Bouton "Téléverser" → input file caché → upload immédiat.
 *   3. Bouton "Supprimer" si une signature existe (confirm natif).
 *
 * Validation côté frontend = double sécurité du backend (mêmes règles) :
 *   - MIME ∈ {image/png, image/jpeg, image/webp}
 *   - taille ≤ 500 Ko
 */
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth/authStore';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import {
  useSignatureMeta,
  useSignaturePreviewUrl,
  useUploadSignature,
  useDeleteSignature,
} from '../hooks/useSignature';

const MAX_BYTES = 500 * 1024;
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const ACCEPT_ATTR = '.png,.jpg,.jpeg,.webp';

export function SignatureSettingsSection() {
  const isAdmin = useAuthStore((s) => s.user?.roles.includes('ADMIN') ?? false);
  const { meta, isLoading } = useSignatureMeta();
  const previewUrl = useSignaturePreviewUrl(meta);
  const { upload, isPending: isUploading } = useUploadSignature();
  const { remove, isPending: isDeleting } = useDeleteSignature();
  const fileRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isAdmin) {
    return null;
  }

  function handlePick() {
    fileRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (!file) return;

    setErrorMsg(null);
    if (!ALLOWED_MIMES.has(file.type)) {
      setErrorMsg('Format non autorisé. Utiliser PNG, JPEG ou WEBP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setErrorMsg('Image trop volumineuse (max 500 Ko).');
      return;
    }
    try {
      await upload(file);
      toast.success('Signature mise à jour.');
    } catch {
      toast.error('Échec du téléversement de la signature.');
    }
  }

  async function handleRemove() {
    // eslint-disable-next-line no-alert
    if (!window.confirm('Supprimer la signature configurée ?')) return;
    try {
      await remove();
      toast.success('Signature supprimée.');
    } catch {
      toast.error('Échec de la suppression.');
    }
  }

  const hasSignature = !!meta;

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHeader>Signature du médecin (auto-injectée sur les PDF)</PanelHeader>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.5 }}>
          La signature scannée est automatiquement intégrée au pied de chaque
          ordonnance, certificat, arrêt de travail, bon d'analyses, bon
          d'imagerie et carnet de vaccination généré.
          <br />
          PNG / JPEG / WEBP, max 500 Ko, idéalement fond transparent et ratio
          ~200×80&nbsp;px.
        </div>

        <div
          data-testid="signature-preview"
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
          {!isLoading && hasSignature && previewUrl && (
            <img
              src={previewUrl}
              alt="Signature configurée"
              style={{ maxWidth: 240, maxHeight: 90, objectFit: 'contain' }}
            />
          )}
          {!isLoading && hasSignature && !previewUrl && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Chargement de l’aperçu…</span>
          )}
          {!isLoading && !hasSignature && (
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              Aucune signature configurée — les PDF utiliseront le cadre cachet vide.
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

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTR}
          onChange={(e) => {
            void handleFile(e);
          }}
          style={{ display: 'none' }}
          data-testid="signature-file-input"
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          {hasSignature && (
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
              : hasSignature
                ? 'Remplacer la signature'
                : 'Téléverser une signature'}
          </Button>
        </div>
      </div>
    </Panel>
  );
}
