/**
 * DocumentUploadButton — composant d'upload partagé (QA5-2).
 *
 * Deux CTAs côte à côte :
 *   1. « Téléverser »   → file picker classique (PDF + images).
 *   2. « Photographier » → ouvre la caméra :
 *      - Mobile (Android/iOS) : `<input capture="environment">` qui
 *        déclenche l'app caméra système. C'est la meilleure UX.
 *      - Desktop : `getUserMedia` via WebcamCaptureModal — affiche un
 *        flux vidéo dans une modale, capture une frame en JPEG.
 *        (Sans cela, `capture` est ignoré et le bouton retombait sur
 *        le picker fichier — rapport Y. Boutaleb 2026-05-01.)
 */
import { useRef, useState } from 'react';
import { Button } from './Button';
import { Camera, Upload } from '@/components/icons';
import { WebcamCaptureModal } from './WebcamCaptureModal';

export interface DocumentUploadButtonProps {
  /** MIME accept pour le bouton « Téléverser ». */
  accept?: string;
  /** Étiquette du bouton « Téléverser ». Défaut : « Téléverser ». */
  uploadLabel?: string;
  /** Étiquette du bouton « Photographier ». Défaut : « Photographier ». */
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

/**
 * Heuristique mobile :
 *   - sur tablette / téléphone, `capture="environment"` ouvre l'app
 *     caméra ; on ne veut PAS afficher la modale getUserMedia.
 *   - sur PC, on ouvre la modale.
 *
 * On préfère la « Coarse Pointer » feature query (`pointer: coarse`)
 * + `Touch` capability, qui est plus fiable que parser le UA.
 */
function isMobileLike(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touch = 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
  return coarse && touch;
}

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
  const [webcamOpen, setWebcamOpen] = useState(false);

  function pick(ref: React.RefObject<HTMLInputElement | null>) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (ref.current) ref.current.value = '';
      if (f) onFile(f);
    };
  }

  function onCameraClick() {
    // Mobile : `capture` sur input fichier → app caméra système.
    // Desktop : modale getUserMedia.
    if (isMobileLike()) {
      camRef.current?.click();
    } else {
      setWebcamOpen(true);
    }
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
            // bibliothèque. Sur desktop on n'arrive jamais ici (bouton
            // route vers WebcamCaptureModal), mais on garde l'attribut
            // pour mobile où il déclenche l'app caméra système.
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
            onClick={onCameraClick}
          >
            <Camera style={{ width: 12, height: 12 }} />
            {cameraLabel}
          </Button>
          <WebcamCaptureModal
            open={webcamOpen}
            onClose={() => setWebcamOpen(false)}
            onCapture={(file) => {
              setWebcamOpen(false);
              onFile(file);
            }}
          />
        </>
      )}
    </div>
  );
}
