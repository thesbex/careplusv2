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
type PdfType = 'CERT' | 'DRUG' | 'LAB' | 'IMAGING' | 'SICK_LEAVE';

interface Props {
  open: boolean;
  type?: PdfType;
}

function labelFor(type: PdfType | undefined): string {
  switch (type) {
    case 'CERT':
      return 'Certificat';
    case 'DRUG':
      return "l'Ordonnance";
    case 'LAB':
      return "Bon d'analyses";
    case 'IMAGING':
      return "Bon d'imagerie";
    case 'SICK_LEAVE':
      return "l'Arrêt de travail";
    default:
      return 'document';
  }
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
  if (!open) return null;
  const label = labelFor(type);
  return (
    <div
      className="pdf-gen-overlay"
      role="status"
      aria-live="polite"
    >
      <div className="pdf-gen-card">
        <Spinner />
        <div className="pdf-gen-text">
          <div className="pdf-gen-title">Génération du {label} en cours…</div>
          <div className="pdf-gen-sub">Cela peut prendre quelques secondes</div>
        </div>
      </div>
    </div>
  );
}
