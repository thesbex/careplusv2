/**
 * Overlay non-bloquant affiché pendant la génération PDF côté serveur
 * (openhtmltopdf + Thymeleaf). La requête prend plusieurs centaines de
 * ms ; sans feedback visuel, le médecin clique 2-3× et génère des
 * doublons. Cf. F9 — feedback pilote 2026-05-06.
 *
 * Toast position bottom-right, par-dessus les Dialog Radix (z-index 110 >
 * .pr-drawer = 101). N'attrape pas les clics (pointer-events: none) ; le
 * blocage anti double-clic vit sur le bouton lui-même via `disabled`.
 */
import { useT } from '@/lib/i18n/I18nProvider';

type PdfType = 'CERT' | 'DRUG' | 'LAB' | 'IMAGING' | 'SICK_LEAVE';

interface Props {
  open: boolean;
  type?: PdfType;
}

/** Spinner SVG inline — évite d'étendre le set d'icônes maison
 *  (`Loader2` n'existe pas) et garde l'animation isolée du composant. */
function Spinner() {
  return (
    <svg
      className="pdf-gen-spin"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="7" opacity="0.25" />
      <path d="M17 10a7 7 0 0 0-7-7" />
    </svg>
  );
}

export function PdfGenerationOverlay({ open, type }: Props) {
  const { t } = useT();
  if (!open) return null;
  const label = t(`presc.gen.label.${type ?? 'default'}`);
  return (
    <div
      className="pdf-gen-overlay"
      role="status"
      aria-live="polite"
    >
      <div className="pdf-gen-card">
        <Spinner />
        <div className="pdf-gen-text">
          <div className="pdf-gen-title">{t('presc.gen.title', { label })}</div>
          <div className="pdf-gen-sub">{t('presc.gen.sub')}</div>
        </div>
      </div>
    </div>
  );
}
