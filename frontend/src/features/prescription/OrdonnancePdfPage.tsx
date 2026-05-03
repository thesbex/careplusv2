/**
 * Screen 08 — Aperçu ordonnance (PDF).
 * Loads the server-rendered PDF as a blob and shows it in an iframe.
 * Download + print actions are wired to browser APIs.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { ChevronLeft, File as FileIcon, Print } from '@/components/icons';
import { usePrescriptionPdf } from './hooks/usePrescriptionPdf';
import { usePrescription } from './hooks/usePrescriptions';
import './prescription.css';

export default function OrdonnancePdfPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { prescription } = usePrescription(id);
  const { url, isLoading, error } = usePrescriptionPdf(id);

  function handleDownload() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordonnance-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handlePrint() {
    const frame = document.getElementById('ordo-pdf-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.print();
  }

  const shortId = id ? id.slice(0, 8).toUpperCase() : '—';

  return (
    <Screen
      active="consult"
      title="Aperçu — Ordonnance"
      sub={`ORD-${shortId}${prescription ? ` · ${new Date(prescription.issuedAt).toLocaleDateString('fr-MA')}` : ''}`}
      topbarRight={
        <>
          <Button onClick={() => navigate(-1)}>
            <ChevronLeft /> Retour
          </Button>
          <Button onClick={handleDownload} disabled={!url}>
            <FileIcon /> Télécharger
          </Button>
          <Button variant="primary" onClick={handlePrint} disabled={!url}>
            <Print /> Imprimer
          </Button>
        </>
      }
      onNavigate={(navId) => {
        const map = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
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
          <iframe
            id="ordo-pdf-frame"
            className="pr-pdf-viewer"
            title="Aperçu ordonnance"
            src={url}
          />
        )}
      </div>
    </Screen>
  );
}
