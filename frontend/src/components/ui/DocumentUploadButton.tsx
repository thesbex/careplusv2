/**
 * DocumentUploadButton — composant d'upload partagé (QA5-2).
 *
 * Deux CTAs côte à côte :
 *   1. "Téléverser"   → file picker classique (PDF + images).
 *   2. "Photographier" → ouvre directement la caméra de l'appareil
 *      (`capture="environment"`, caméra arrière par défaut).
 *
 * Sur desktop, `capture` est ignoré par le navigateur → le bouton
 * "Photographier" ouvre quand même le picker. On le cache si la prop
 * `cameraOnly` n'est pas demandée et qu'on détecte qu'il n'y a pas
 * de média en entrée (heuristique simple : l'attribut `capture` n'est
 * pas significatif sur un Mac/PC).
 */
import { useRef } from 'react';
import { Button } from './Button';
import { Camera, Upload } from '@/components/icons';

export interface DocumentUploadButtonProps {
  /** MIME accept pour le bouton "Téléverser". */
  accept?: string;
  /** Étiquette du bouton "Téléverser". Défaut : "Téléverser". */
  uploadLabel?: string;
  /** Étiquette du bouton "Photographier". Défaut : "Photographier". */
  cameraLabel?: string;
  /** Désactive les deux boutons (ex. en cours d'upload). */
  disabled?: boolean;
  /** Variante (forwardée à `Button`). */
  variant?: 'primary' | 'default' | 'ghost';
  size?: 'sm' | 'md';
  /** Si true, n'expose que le bouton caméra (pour photo patient). */
  cameraOnly?: boolean;
  /** Si true, n'expose que le bouton upload (cas où la caméra est non pertinente). */
  uploadOnly?: boolean;
  /**
   * Appelé quand un fichier est choisi (depuis l'un ou l'autre des deux
   * inputs). Le composant remet l'input à zéro juste après pour permettre
   * à l'utilisateur de re-sélectionner le même fichier.
   */
  onFile: (file: File) => void;
}

const DEFAULT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';

export function DocumentUploadButton({
  accept = DEFAULT_ACCEPT,
  uploadLabel = 'Téléverser',
  cameraLabel = 'Photographier',
  disabled = false,
  variant = 'primary',
  size = 'sm',
  cameraOnly = false,
  uploadOnly = false,
  onFile,
}: DocumentUploadButtonProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const camRef = useRef<HTMLInputElement | null>(null);

  function pick(ref: React.RefObject<HTMLInputElement | null>) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (ref.current) ref.current.value = '';
      if (f) onFile(f);
    };
  }

  return (
    <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {!cameraOnly && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            hidden
            onChange={pick(fileRef)}
          />
          <Button
            type="button"
            variant={variant}
            size={size}
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
          >
            <Upload style={{ width: 12, height: 12 }} />
            {uploadLabel}
          </Button>
        </>
      )}
      {!uploadOnly && (
        <>
          <input
            ref={camRef}
            type="file"
            accept="image/*"
            // `capture` indique à l'OS d'ouvrir la caméra plutôt que la
            // bibliothèque. Ignoré silencieusement sur desktop.
            // Workaround Vite : `capture="environment"` doit rester string.
            {...{ capture: 'environment' as unknown as boolean }}
            hidden
            onChange={pick(camRef)}
          />
          <Button
            type="button"
            variant={cameraOnly ? variant : 'default'}
            size={size}
            disabled={disabled}
            onClick={() => camRef.current?.click()}
          >
            <Camera style={{ width: 12, height: 12 }} />
            {cameraLabel}
          </Button>
        </>
      )}
    </div>
  );
}
