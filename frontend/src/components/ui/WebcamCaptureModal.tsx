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
import { useT } from '@/lib/i18n/I18nProvider';

export interface WebcamCaptureModalProps {
  open: boolean;
  /** MIME du blob renvoyé. Défaut : image/jpeg (compact). */
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp';
  /** Qualité JPEG (0..1). Défaut : 0.92. */
  quality?: number;
  /** Largeur cible — la frame est rognée si la caméra est plus grande. */
  maxWidth?: number;
  /** Étiquette du bouton « Capturer ». Défaut : traduction `ui.webcam.capture`. */
  captureLabel?: string;
  onCapture: (file: File) => void;
  onClose: () => void;
}

/** Structured error so we can render a title, an explanation AND actionable hints. */
interface CameraError {
  title: string;
  detail: string;
  hints: string[];
  /** Underlying DOMException name for log/debug — surfaced in small text. */
  cause?: string | undefined;
}

export function WebcamCaptureModal({
  open,
  mimeType = 'image/jpeg',
  quality = 0.92,
  maxWidth = 1280,
  captureLabel,
  onCapture,
  onClose,
}: WebcamCaptureModalProps) {
  const { t } = useT();
  const resolvedCaptureLabel = captureLabel ?? t('ui.webcam.capture');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  // Flux acquis, branché au <video> par un effet dédié (cf. plus bas). On NE
  // branche PAS srcObject directement dans le callback getUserMedia : le <video>
  // est démonté tant qu'une erreur s'affiche, donc sur le chemin « Réessayer » le
  // flux arrivait avant le remontage du <video> → srcObject jamais posé → bouton
  // « Capturer » bloqué désactivé. Passer par un state garantit le branchement
  // une fois le <video> monté.
  const [stream, setStream] = useState<MediaStream | null>(null);
  // Bumper pour forcer un retry — re-run l'effet d'attachement caméra.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);
    setStream(null);

    if (!window.isSecureContext) {
      setError({
        title: t('ui.webcam.err.insecure.title'),
        detail: t('ui.webcam.err.insecure.detail'),
        hints: [t('ui.webcam.err.insecure.hint')],
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError({
        title: t('ui.webcam.err.unsupported.title'),
        detail: t('ui.webcam.err.unsupported.detail'),
        hints: [t('ui.webcam.err.unsupported.hint')],
      });
      return;
    }

    // Sur PC il n'y a souvent qu'une seule webcam frontale. Si on demande
    // facingMode strict 'environment', certains navigateurs (Chrome desktop,
    // Edge) renvoient NotFoundError → l'utilisateur voyait "Aucune caméra
    // détectée" alors qu'une caméra existe (rapport 2026-05-01).
    // 1) `ideal` au lieu de strict laisse le navigateur retomber sur une
    //    autre caméra si l'arrière n'existe pas.
    // 2) En cas d'OverconstrainedError / NotFoundError on retry sans contrainte,
    //    pour couvrir Firefox qui ne respecte pas toujours `ideal`.
    const primary: MediaStreamConstraints = {
      video: { facingMode: { ideal: 'environment' }, width: { ideal: maxWidth } },
      audio: false,
    };
    const fallback: MediaStreamConstraints = { video: true, audio: false };

    function attach(stream: MediaStream) {
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      // Le branchement au <video> se fait dans l'effet dédié [stream] (le <video>
      // peut ne pas encore être monté ici, ex. après « Réessayer »).
      setStream(stream);
    }

    function reportError(err: unknown, hasVideoDevice: boolean | null) {
      if (cancelled) return;
      const cause = err instanceof DOMException ? err.name : undefined;
      const causeMsg = err instanceof Error ? err.message : '';

      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) {
        setError({
          title: t('ui.webcam.err.denied.title'),
          detail: t('ui.webcam.err.denied.detail'),
          hints: [
            t('ui.webcam.err.denied.hint1'),
            t('ui.webcam.err.denied.hint2'),
          ],
          cause,
        });
        return;
      }
      if (err instanceof DOMException && err.name === 'NotReadableError') {
        setError({
          title: t('ui.webcam.err.busy.title'),
          detail: t('ui.webcam.err.busy.detail'),
          hints: [
            t('ui.webcam.err.busy.hint1'),
            t('ui.webcam.err.busy.hint2'),
          ],
          cause,
        });
        return;
      }
      // NotFoundError / OverconstrainedError → on distingue
      // « pas de caméra du tout » de « contrainte trop stricte ».
      if (hasVideoDevice === false) {
        setError({
          title: t('ui.webcam.err.noCam.title'),
          detail: t('ui.webcam.err.noCam.detail'),
          hints: [
            t('ui.webcam.err.noCam.hint1'),
            t('ui.webcam.err.noCam.hint2'),
            t('ui.webcam.err.noCam.hint3'),
          ],
          cause,
        });
        return;
      }
      setError({
        title: t('ui.webcam.err.generic.title'),
        detail: causeMsg || t('ui.webcam.err.generic.detail'),
        hints: [t('ui.webcam.err.generic.hint')],
        cause,
      });
    }

    // 1) Probe enumerateDevices() FIRST — révèle « pas de webcam au niveau
    //    OS » avant d'aller chercher un message d'erreur générique.
    //    Les `videoinput` apparaissent même sans permission (label vide).
    const probe = navigator.mediaDevices.enumerateDevices
      ? navigator.mediaDevices.enumerateDevices().then(
          (devs) => devs.some((d) => d.kind === 'videoinput'),
          () => null as boolean | null,
        )
      : Promise.resolve(null as boolean | null);

    void probe.then((hasVideoDevice) => {
      if (cancelled) return;
      if (hasVideoDevice === false) {
        reportError(
          new DOMException('No videoinput device exposed by the OS', 'NotFoundError'),
          false,
        );
        return;
      }
      navigator.mediaDevices
        .getUserMedia(primary)
        .then(attach)
        .catch((err: unknown) => {
          // Permission/security errors must NOT silently retry — the user has
          // to act. Only fall back when the constraint itself was the problem.
          const recoverable =
            err instanceof DOMException &&
            (err.name === 'OverconstrainedError' || err.name === 'NotFoundError');
          if (!recoverable || cancelled) {
            reportError(err, hasVideoDevice);
            return;
          }
          navigator.mediaDevices
            .getUserMedia(fallback)
            .then(attach)
            .catch((err2: unknown) => {
              // The fallback asked for ANY video device. If it ALSO fails with
              // NotFoundError/OverconstrainedError, the OS truly exposes no
              // camera — surface that diagnosis even if enumerateDevices was
              // optimistic (some browsers list a `videoinput` ghost when the
              // user previously granted permission to a now-disconnected cam).
              const exhausted =
                err2 instanceof DOMException &&
                (err2.name === 'NotFoundError' || err2.name === 'OverconstrainedError');
              reportError(err2, exhausted ? false : hasVideoDevice);
            });
        });
    });

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setReady(false);
    };
  }, [open, maxWidth, retryNonce, t]);

  // Branche le flux acquis au <video> dès qu'il est monté (après que l'erreur ait
  // disparu). Indépendant de l'effet d'acquisition pour éviter la course
  // « flux prêt avant montage du <video> » (chemin Réessayer).
  useEffect(() => {
    const v = videoRef.current;
    if (!stream || !v) return;
    v.srcObject = stream;
    v.onloadedmetadata = () => setReady(true);
    // Certains navigateurs (autoplay strict, webcams USB lentes) ne déclenchent
    // pas autoplay → ready resterait false. On force play() et on arme un
    // filet de sécurité à 3 s qui passe ready=true si une frame est arrivée.
    const playPromise = v.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => { /* autoplay bloqué — fallback timeout ci-dessous */ });
    }
    const id = setTimeout(() => {
      if (v.videoWidth > 0) setReady(true);
    }, 3000);
    return () => clearTimeout(id);
  }, [stream]);

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
      setError({
        title: t('ui.webcam.err.capture.title'),
        detail: err instanceof Error ? err.message : String(err),
        hints: [t('ui.webcam.err.capture.hint')],
      });
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('ui.webcam.title')}
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
          <strong>{t('ui.webcam.title')}</strong>
          <div style={{ flex: 1 }} />
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.close')}
          </Button>
        </div>
        {error ? (
          <div
            role="alert"
            style={{
              padding: 14,
              borderRadius: 8,
              background: 'var(--danger-soft, #FFEBEE)',
              border: '1px solid #EF9A9A',
              color: 'var(--ink, #2A2D33)',
              fontSize: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <strong style={{ color: 'var(--danger, #b91c1c)' }}>{error.title}</strong>
            <span>{error.detail}</span>
            {error.hints.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--ink-2, #4B4F58)' }}>
                {error.hints.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
            {error.cause && (
              <code style={{ fontSize: 11, color: 'var(--ink-3, #7A7F8A)' }}>
                {t('ui.webcam.codeLabel', { code: error.cause })}
              </code>
            )}
            <div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setRetryNonce((n) => n + 1)}
              >
                {t('ui.webcam.retry')}
              </Button>
            </div>
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
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!ready || busy || !!error}
            onClick={handleCapture}
          >
            <Camera style={{ width: 14, height: 14 }} />
            {busy ? t('ui.webcam.capturing') : resolvedCaptureLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
