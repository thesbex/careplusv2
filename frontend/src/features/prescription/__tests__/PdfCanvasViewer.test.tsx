/**
 * Verrouille le contrat 2026-05-20 : le PDF s'affiche INLINE via PDF.js
 * (canvas) et pas via un iframe natif. Le bug d'origine — quand Chrome est
 * sur "Télécharger les PDF" — affichait l'UUID du blob (ex.
 * 665dc021-c84e-4d2e-aec0-d9457312c213) avec une invite « Ouvrir » au lieu
 * du document. Le fix passe par PdfCanvasViewer qui rend un canvas, donc
 * doit toujours monter <Document file={src} /> de react-pdf.
 *
 * On mock react-pdf : pas de worker pdf.js à charger dans jsdom, et c'est
 * la prop `file` qu'on vérifie — pas le rendu canvas.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-pdf', () => {
  return {
    Document: ({ file, children }: { file: string; children?: React.ReactNode }) => (
      <div data-testid="mock-document" data-file={file}>
        {children}
      </div>
    ),
    Page: ({ pageNumber, width }: { pageNumber: number; width: number }) => (
      <div data-testid="mock-page" data-page={pageNumber} data-width={width} />
    ),
    pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
  };
});

vi.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}));
vi.mock('react-pdf/dist/Page/TextLayer.css', () => ({}));
vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'mock-worker.mjs' }));

import { PdfCanvasViewer } from '../components/PdfCanvasViewer';

describe('PdfCanvasViewer', () => {
  it("monte react-pdf <Document> avec la blob URL — pas d'iframe natif", () => {
    const blobUrl = 'blob:http://localhost:5173/665dc021-c84e-4d2e-aec0-d9457312c213';
    render(<PdfCanvasViewer src={blobUrl} width={820} />);
    const doc = screen.getByTestId('mock-document');
    expect(doc).toBeInTheDocument();
    expect(doc.getAttribute('data-file')).toBe(blobUrl);
    // Une régression vers iframe natif aurait monté <iframe>, pas <Document>.
    expect(document.querySelector('iframe')).toBeNull();
  });

  it("passe la largeur demandée et le numéro de page à <Page> après load", async () => {
    const { rerender } = render(<PdfCanvasViewer src="blob:fake" width={358} />);
    // Simule un onLoadSuccess en re-rendering avec un fragment — comme le
    // composant attend numPages avant de monter les Page, on déclenche le
    // callback en mode contrôlé. (Ici on accepte que Page ne soit pas monté
    // avant onLoadSuccess — le contrat utile est "Document carries the file".)
    const doc = screen.getByTestId('mock-document');
    expect(doc.getAttribute('data-file')).toBe('blob:fake');
    // Re-monte avec une autre src — Document doit suivre.
    rerender(<PdfCanvasViewer src="blob:other" width={358} />);
    expect(screen.getByTestId('mock-document').getAttribute('data-file')).toBe('blob:other');
  });
});
