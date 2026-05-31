/**
 * PdfCanvasViewer — rend un PDF via PDF.js (canvas) au lieu de l'`<iframe>`
 * natif du navigateur.
 *
 * Pourquoi ne pas garder l'iframe blob ?
 *   Chrome / Edge respectent le paramètre utilisateur
 *   `chrome://settings/content/pdfDocuments` : si la valeur est passée à
 *   « Télécharger les PDF », l'iframe (ou n'importe quel embed PDF) force
 *   un téléchargement et affiche à la place du contenu le nom de fichier
 *   blob (un UUID) + une invite « Ouvrir » du navigateur. Le médecin voit
 *   alors « 665dc021-c84e-4d2e-aec0-d9457312c213 » au lieu du document.
 *
 * PDF.js rend le PDF en canvas côté JS — insensible à ce paramètre. Marche
 * aussi sur les navigateurs sans visionneuse PDF intégrée (anciens Firefox
 * sans plugin, iOS Safari < 17 dans certains contextes…).
 *
 * Bundle : worker pdf.js servi en local (Vite `?url` import) — pas de CDN
 * pour respecter le déploiement on-premise (cf. CLAUDE.md tech stack).
 */
import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useT } from '@/lib/i18n/I18nProvider';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
// Vite résout l'URL du worker en build (chunk séparé). PDF.js le télécharge
// au premier rendu — ~300 Ko, mis en cache ensuite.
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props {
  /** Blob URL (générée via URL.createObjectURL côté hook PDF). */
  src: string;
  /** Largeur par défaut du rendu. Utile pour mobile (390 px) vs desktop. */
  width?: number;
  className?: string;
  /** Hauteur conteneur — utile pour le scroll quand multi-pages. */
  maxHeight?: string | number;
}

export function PdfCanvasViewer({ src, width = 800, className, maxHeight }: Props) {
  const { t } = useT();
  const [numPages, setNumPages] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset quand on change de PDF (id différent).
  useEffect(() => {
    setNumPages(null);
    setLoadError(null);
  }, [src]);

  return (
    <div
      className={className}
      style={{
        background: 'var(--surface-2, #f5f5f5)',
        overflow: 'auto',
        maxHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: 12,
        gap: 12,
      }}
    >
      {loadError && (
        <div style={{ color: 'var(--danger)', fontSize: 13, padding: 12 }}>
          {loadError}
        </div>
      )}
      <Document
        file={src}
        onLoadSuccess={({ numPages: n }) => setNumPages(n)}
        onLoadError={(err) => {
          // eslint-disable-next-line no-console
          console.error('[PdfCanvasViewer] PDF.js loadError', err);
          setLoadError(t('presc.canvas.loadError'));
        }}
        loading={
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: 24 }}>
            {t('presc.canvas.loading')}
          </div>
        }
      >
        {numPages !== null &&
          Array.from({ length: numPages }, (_, i) => (
            <Page
              key={`page-${i + 1}`}
              pageNumber={i + 1}
              width={width}
              renderAnnotationLayer={false}
              renderTextLayer={false}
              loading={null}
            />
          ))}
      </Document>
    </div>
  );
}
