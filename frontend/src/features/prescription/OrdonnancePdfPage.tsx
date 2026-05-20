/**
 * Screen 08 — Aperçu document (PDF) — desktop.
 *
 * Polyvalent : ce composant est utilisé pour TOUS les types de prescription
 * (DRUG = ordonnance, LAB = bon d'analyses, IMAGING = bon d'imagerie,
 * CERT = certificat médical, SICK_LEAVE = arrêt de travail). Le titre, le
 * préfixe court et le nom de fichier téléchargé sont dérivés du `type`
 * stocké en DB — pas hardcodés.
 *
 * Le PDF est récupéré en blob (auth bearer en mémoire — voir ADR-019), puis
 * rendu dans un `<iframe>` qui s'appuie sur la `blob:` URL locale (pas de
 * second appel HTTP, donc pas d'header Authorization à transmettre).
 *
 * Boutons Télécharger / Imprimer travaillent sur la même blob URL.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, File as FileIcon, Print } from '@/components/icons';
import { useDocumentPdfController, metaForPrescription } from './components/DocumentPdfViewer';
import { PdfCanvasViewer } from './components/PdfCanvasViewer';
import { usePrescription } from './hooks/usePrescriptions';
import './prescription.css';

export default function OrdonnancePdfPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { prescription } = usePrescription(id);
  const { url, isLoading, error, iframeId, download, print } = useDocumentPdfController(id);

  const meta = metaForPrescription(prescription);
  const shortId = id ? id.slice(0, 8).toUpperCase() : '—';

  function handleDownload() {
    download(`${meta.fileSlug}-${shortId}.pdf`);
  }

  return (
    <Screen
      active="consult"
      title={`Aperçu — ${meta.label}`}
      sub={`${meta.prefix}-${shortId}${prescription ? ` · ${new Date(prescription.issuedAt).toLocaleDateString('fr-MA')}` : ''}`}
      topbarRight={
        <>
          <Button onClick={() => navigate(-1)}>
            <ChevronLeft /> Retour
          </Button>
          <Button onClick={handleDownload} disabled={!url}>
            <FileIcon /> Télécharger
          </Button>
          <Button variant="primary" onClick={print} disabled={!url}>
            <Print /> Imprimer
          </Button>
        </>
      }
      onNavigate={(navId) => {
        const map = {
          dashboard: '/dashboard',
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          vaccinations: '/vaccinations',
          grossesses: '/grossesses',
          stock: '/stock',
          queueLab: '/queue/lab',
          queueRadio: '/queue/radio',
          catalogue: '/catalogue',
          params: '/parametres',
        } as const;
        navigate(map[navId]);
      }}
    >
      <div style={{ height: '100%', background: 'var(--bg-alt)' }}>
        {isLoading && (
          <div style={{ padding: 24, color: 'var(--ink-3)', fontSize: 13 }}>
            Chargement du PDF…
          </div>
        )}
        {error && (
          <div style={{ padding: 24, color: 'var(--danger)', fontSize: 13 }}>{error}</div>
        )}
        {url && (
          <>
            {/* iframe caché : cible pour iframe.contentWindow.print() (bouton
                Imprimer) — le PDF rendu visible passe par PdfCanvasViewer
                (PDF.js, insensible au paramètre Chrome "Télécharger les PDF"). */}
            <iframe
              id={iframeId}
              title={`Aperçu ${meta.label}`}
              src={url}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <PdfCanvasViewer
              src={url}
              width={820}
              maxHeight="100%"
              className="pr-pdf-viewer-canvas"
            />
          </>
        )}
      </div>
    </Screen>
  );
}
