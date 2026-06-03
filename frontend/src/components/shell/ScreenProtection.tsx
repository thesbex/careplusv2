/**
 * Dissuasion capture d'écran / enregistrement vidéo (demande produit).
 *
 * ⚠️ Limite honnête : une application web NE PEUT PAS empêcher techniquement une
 * capture OS (Impr.écran, outil Capture, photo au téléphone, OBS, partage
 * d'écran…). Le navigateur n'a pas cet accès. Ce composant met donc en place une
 * couche de DISSUASION + TRAÇABILITÉ, pas un blocage absolu :
 *
 *  1. Filigrane d'identité (nom + e-mail de l'utilisateur connecté + horodatage)
 *     répété en diagonale sur toute l'app → toute capture ou tout enregistrement
 *     reste attribuable à la session qui l'a produite (effet dissuasif réel).
 *  2. Menu contextuel (clic droit) désactivé — gêne « Enregistrer l'image » /
 *     inspection occasionnelle.
 *  3. Touche Impr.écran : meilleure-effort (efface le presse-papiers + avertit).
 *     Non garanti (la touche est gérée par l'OS), purement dissuasif.
 *
 * Un vrai blocage de capture nécessiterait un conteneur natif desktop
 * (ex. Electron `setContentProtection(true)`), hors périmètre de l'app web.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';

/** Horodatage local « AAAA-MM-JJ HH:MM » (pas d'UTC : composantes locales). */
function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function ScreenProtection() {
  const user = useAuthStore((s) => s.user);
  const { t } = useT();
  const [stamp, setStamp] = useState(() => localStamp(new Date()));

  // Rafraîchit l'horodatage chaque minute (preuve plus précise sur une capture).
  useEffect(() => {
    const id = window.setInterval(() => setStamp(localStamp(new Date())), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Dissuasion : clic droit + Impr.écran (meilleure-effort).
  useEffect(() => {
    function onContextMenu(e: MouseEvent) {
      e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === 'PrintScreen') {
        // On ne PEUT PAS empêcher la capture OS ; on tente d'effacer le
        // presse-papiers (souvent là qu'atterrit la capture) et on avertit.
        try {
          void navigator.clipboard?.writeText('');
        } catch {
          /* presse-papiers indisponible — sans gravité */
        }
        toast.warning(t('security.captureRestricted'));
      }
    }
    document.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [t]);

  if (!user) return null;

  const label = `${user.firstName} ${user.lastName} · ${user.email} · ${stamp}`;
  // Filigrane via SVG en data-URI répété (tuile) : performant, net, sans DOM lourd.
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='360' height='200'>` +
    `<text x='0' y='100' transform='rotate(-28 180 100)' ` +
    `fill='rgba(110,110,110,0.13)' font-size='13' font-family='sans-serif' font-weight='600'>` +
    `${label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}` +
    `</text></svg>`;
  const bg = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  return (
    <div
      aria-hidden
      data-testid="screen-watermark"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        pointerEvents: 'none',
        backgroundImage: bg,
        backgroundRepeat: 'repeat',
        // Garde le filigrane visible à l'impression / « imprimer en PDF » aussi
        // (sinon ce serait un vecteur de capture sans traçabilité).
        printColorAdjust: 'exact',
      }}
    />
  );
}
