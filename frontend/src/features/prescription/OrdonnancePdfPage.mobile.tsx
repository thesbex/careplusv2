/**
 * Aperçu ordonnance — mobile.
 *
 * Mobile browsers (especially iOS Safari) do not reliably render
 * `application/pdf` inside an <iframe> — the desktop view ends up blank.
 * This variant renders the prescription lines as native HTML and offers a
 * download / print fallback that opens the PDF blob in a new tab where the
 * OS PDF viewer can take over.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { File as FileIcon, Print, Warn } from '@/components/icons';
import { usePrescription } from './hooks/usePrescriptions';
import { usePrescriptionPdf } from './hooks/usePrescriptionPdf';
import type { PrescriptionLineApi } from './types';
import './prescription.css';

const TYPE_LABEL: Record<string, string> = {
  DRUG: 'Médicaments',
  LAB: 'Analyses',
  IMAGING: 'Imagerie',
  CERT: 'Certificat',
  SICK_LEAVE: 'Arrêt de travail',
};

function lineTitle(l: PrescriptionLineApi): string {
  if (l.freeText && l.freeText.trim()) return l.freeText.trim();
  if (l.medicationId) return `Médicament · ${l.medicationId.slice(0, 8).toUpperCase()}`;
  if (l.labTestId) return `Analyse · ${l.labTestId.slice(0, 8).toUpperCase()}`;
  if (l.imagingExamId) return `Imagerie · ${l.imagingExamId.slice(0, 8).toUpperCase()}`;
  return 'Ligne sans description';
}

function lineMeta(l: PrescriptionLineApi): string {
  return [l.dosage, l.frequency, l.duration, l.route, l.timing]
    .filter((s) => s && s.trim())
    .join(' · ');
}

export default function OrdonnancePdfMobilePage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { prescription, isLoading, error } = usePrescription(id);
  const { url, isLoading: pdfLoading } = usePrescriptionPdf(id);

  const shortId = id ? id.slice(0, 8).toUpperCase() : '—';
  const typeLabel = prescription?.type
    ? TYPE_LABEL[prescription.type] ?? prescription.type
    : '—';

  function openPdf() {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function downloadPdf() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `ordonnance-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <MScreen
      tab="agenda"
      noTabs
      onTabChange={() => undefined}
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate(-1)} />}
          title={`ORD-${shortId}`}
          sub={prescription ? typeLabel : 'Aperçu'}
        />
      }
    >
      <div className="mb-pad">
        {isLoading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
            Chargement…
          </div>
        )}
        {error && (
          <div style={{ color: 'var(--danger)', fontSize: 13, padding: '12px 0' }}>
            {error}
          </div>
        )}

        {prescription && (
          <>
            {/* Header card */}
            <div className="m-card" style={{ marginBottom: 14, padding: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Ordonnance
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                ORD-{shortId}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                {typeLabel} · émise le{' '}
                {new Date(prescription.issuedAt).toLocaleDateString('fr-MA', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
              {prescription.allergyOverride && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    background: 'var(--amber-soft)',
                    borderRadius: 'var(--r-lg)',
                    color: 'var(--amber)',
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Warn aria-hidden="true" /> Override allergie validé par le médecin
                </div>
              )}
            </div>

            {/* Lines */}
            <div className="m-section-h">
              <h3>Lignes</h3>
              <span className="more">{prescription.lines.length}</span>
            </div>
            <div className="m-card" style={{ marginBottom: 14 }}>
              {prescription.lines.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>
                  Aucune ligne.
                </div>
              ) : (
                prescription.lines
                  .slice()
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((l, i) => {
                    const meta = lineMeta(l);
                    return (
                      <div
                        key={l.id}
                        className="m-row"
                        style={{
                          borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                          alignItems: 'flex-start',
                        }}
                      >
                        <div className="m-row-pri">
                          <div className="m-row-main">{lineTitle(l)}</div>
                          {meta && (
                            <div className="m-row-sub" style={{ marginTop: 4 }}>
                              {meta}
                            </div>
                          )}
                          {l.instructions && l.instructions.trim() && (
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--ink-2)',
                                marginTop: 6,
                                fontStyle: 'italic',
                                lineHeight: 1.4,
                              }}
                            >
                              {l.instructions}
                            </div>
                          )}
                        </div>
                        {l.quantity != null && (
                          <span
                            className="m-pill"
                            style={{
                              background: 'var(--primary-soft)',
                              color: 'var(--primary)',
                            }}
                          >
                            ×{l.quantity}
                          </span>
                        )}
                      </div>
                    );
                  })
              )}
            </div>

            {/* PDF actions — open / download. We don't render the PDF inline
                on mobile because iframe PDF rendering is unreliable on
                iOS Safari. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="m-btn"
                style={{ height: 44 }}
                disabled={!url || pdfLoading}
                onClick={openPdf}
              >
                <Print aria-hidden="true" /> Aperçu PDF
              </button>
              <button
                type="button"
                className="m-btn primary"
                style={{ height: 44 }}
                disabled={!url || pdfLoading}
                onClick={downloadPdf}
              >
                <FileIcon aria-hidden="true" /> Télécharger
              </button>
            </div>

            {pdfLoading && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  color: 'var(--ink-3)',
                  textAlign: 'center',
                }}
              >
                Préparation du PDF…
              </div>
            )}
          </>
        )}
      </div>
    </MScreen>
  );
}
