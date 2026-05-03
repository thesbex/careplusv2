/**
 * WebcamCaptureModal — capture une photo via la webcam du PC.
 *
 * Pourquoi : `<input capture="environment">` est ignoré par les
 * navigateurs desktop, donc « Photographier » ouvrait le même
 * picker que « Téléverser » (rapport Y. Boutaleb 2026-05-01).
 * On bascule vers `getUserMedia` quand on est sur desktop, ce qui
 * affiche un flux vidéo et permet de figer une frame.
 *
 * Mobile : ne passe pas par ce composant — `capture="environment"`
 * sur l'`<input>` ouvre directement l'app caméra système, ce qui est
 * la meilleure UX sur smartphone.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Camera } from '@/components/icons';

export interface WebcamCaptureModalProps {
  open: boolean;
  /** MIME du blob renvoyé. Défaut : image/jpeg (compact). */
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Qualité JPEG (0..1). Défaut : 0.92. */
  quality?: number;
  /** Largeur cible — la frame est rognée si la caméra est plus grande. */
  maxWidth?: number;
  /** Étiquette du bouton « Capturer ». */
  captureLabel?: string;
  onCapture: (file: File) => void;
  onClose: () => void;
}

export function WebcamCaptureModal({
  open,
  mimeType = 'image/jpeg',
  quality = 0.92,
  maxWidth = 1280,
  captureLabel = 'Capturer',
  onCapture,
  onClose,
}: WebcamCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne supporte pas la capture caméra.");
      return;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment', width: { ideal: maxWidth } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Caméra inaccessible.';
        // Code DOMException usuels : NotAllowedError, NotFoundError, NotReadableError.
        if (err instanceof DOMException) {
          if (err.name === 'NotAllowedError') {
            setError("Permission caméra refusée. Autorisez l'accès dans le navigateur puis réessayez.");
            return;
          }
          if (err.name === 'NotFoundError') {
            setError('Aucune caméra détectée sur cet appareil.');
            return;
          }
          if (err.name === 'NotReadableError') {
            setError("Caméra utilisée par une autre application. Fermez-la puis réessayez.");
            return;
          }
        }
        setError(msg);
      });

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setReady(false);
    };
  }, [open, maxWidth]);

  async function handleCapture() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setBusy(true);
    try {
      const w = Math.min(video.videoWidth, maxWidth);
      const ratio = w / video.videoWidth;
      const h = Math.round(video.videoHeight * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas indisponible');
      ctx.drawImage(video, 0, 0, w, h);
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), mimeType, quality),
      );
      if (!blob) throw new Error('Encodage image échoué');
      const ext = mimeType.split('/')[1] ?? 'jpg';
      const name = `photo-${new Date().toISOString().replace(/[:.]/g, '-')}.${ext}`;
      const file = new File([blob], name, { type: mimeType });
      onCapture(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Capture caméra"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface, #fff)',
          borderRadius: 12,
          padding: 16,
          maxWidth: 720,
          width: 'calc(100% - 32px)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Camera style={{ width: 18, height: 18 }} />
          <strong>Capture caméra</strong>
          <div style={{ flex: 1 }} />
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Fermer
          </Button>
        </div>
        {error ? (
          <div role="alert" style={{ color: 'var(--danger, #b91c1c)', fontSize: 14 }}>
            {error}
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              maxHeight: '60vh',
              background: '#000',
              borderRadius: 8,
              objectFit: 'contain',
            }}
          />
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!ready || busy || !!error}
            onClick={handleCapture}
          >
            <Camera style={{ width: 14, height: 14 }} />
            {busy ? 'Capture…' : captureLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
