/**
 * Aperçu document — mobile (tous types : ordonnance, certificat, bon
 * d'analyses, bon d'imagerie, arrêt de travail).
 *
 * User feedback 2026-05-17 : "le document doit s'afficher automatiquement
 * sur la page, c'est plus pratique". Pre-fix this page deliberately hid
 * the inline PDF (only the metadata + open/download buttons) because iOS
 * Safari sometimes refuses to render application/pdf inside an iframe.
 * Reality on every modern Android + Chrome + Edge + desktop Safari : the
 * iframe DOES render inline. We now mount the iframe by default and keep
 * the two action buttons immediately under it as a fallback for the iOS
 * Safari edge case (the blob URL still lets the OS take over with "Open").
 */
import { useNavigate, useParams } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import { File as FileIcon, Print, Warn } from '@/components/icons';
import { useT, type I18nContextValue } from '@/lib/i18n/I18nProvider';
import { usePrescription } from './hooks/usePrescriptions';
import { useDocumentPdfBlob, metaForPrescription } from './components/DocumentPdfViewer';
import { PdfCanvasViewer } from './components/PdfCanvasViewer';
import type { PrescriptionLineApi } from './types';
import './prescription.css';

function lineTitle(l: PrescriptionLineApi, t: I18nContextValue['t']): string {
  if (l.freeText && l.freeText.trim()) return l.freeText.trim();
  if (l.medicationId) return t('presc.mobile.line.med', { code: l.medicationId.slice(0, 8).toUpperCase() });
  if (l.labTestId) return t('presc.mobile.line.lab', { code: l.labTestId.slice(0, 8).toUpperCase() });
  if (l.imagingExamId) return t('presc.mobile.line.imaging', { code: l.imagingExamId.slice(0, 8).toUpperCase() });
  return t('presc.mobile.line.empty');
}

function lineMeta(l: PrescriptionLineApi): string {
  return [l.dosage, l.frequency, l.duration, l.route, l.timing]
    .filter((s) => s && s.trim())
    .join(' · ');
}

export default function OrdonnancePdfMobilePage() {
  const { t } = useT();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { prescription, isLoading, error } = usePrescription(id);
  const { url, isLoading: pdfLoading } = useDocumentPdfBlob(id);

  const docMeta = metaForPrescription(prescription);
  const docLabel = t(docMeta.labelKey);
  const shortId = id ? id.slice(0, 8).toUpperCase() : '—';
  const typeLabel = prescription?.type
    ? t(`presc.typeLabel.${prescription.type}`)
    : '—';

  function openPdf() {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function downloadPdf() {
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docMeta.fileSlug}-${shortId}.pdf`;
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
          left={<MIconBtn icon="ChevronLeft" label={t('presc.preview.back')} onClick={() => navigate(-1)} />}
          title={`${docMeta.prefix}-${shortId}`}
          sub={prescription ? typeLabel : t('presc.preview.sub')}
        />
      }
    >
      <div className="mb-pad">
        {isLoading && (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
            {t('presc.preview.loading')}
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
                {docLabel}
              </div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--primary)', marginTop: 4 }}>
                {docMeta.prefix}-{shortId}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>
                {t('presc.mobile.issuedOn', {
                  type: typeLabel,
                  date: new Date(prescription.issuedAt).toLocaleDateString('fr-MA', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  }),
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
                  <Warn aria-hidden="true" /> {t('presc.mobile.overrideValidated')}
                </div>
              )}
            </div>

            {/* Lines */}
            <div className="m-section-h">
              <h3>{t('presc.mobile.linesTitle')}</h3>
              <span className="more">{prescription.lines.length}</span>
            </div>
            <div className="m-card" style={{ marginBottom: 14 }}>
              {prescription.lines.length === 0 ? (
                <div style={{ padding: 16, color: 'var(--ink-3)', fontSize: 13 }}>
                  {t('presc.mobile.noLine')}
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
                          <div className="m-row-main">{lineTitle(l, t)}</div>
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

            {/* Inline PDF preview via PDF.js canvas (2026-05-20) — insensible
                au paramètre Chrome « Télécharger les PDF » qui faisait afficher
                l'UUID du blob au lieu du document. Marche aussi sur iOS Safari
                qui refuse souvent l'iframe-PDF. Les boutons Aperçu / Télécharger
                en dessous restent comme fallback. */}
            {url && (
              <div
                className="m-card"
                style={{
                  marginBottom: 12,
                  padding: 0,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <PdfCanvasViewer src={url} width={358} maxHeight="60vh" />
              </div>
            )}

            {/* PDF actions — open / download. Kept as a fallback for browsers
                (notably iOS Safari) that may render the iframe blank. */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <button
                type="button"
                className="m-btn"
                style={{ height: 44 }}
                disabled={!url || pdfLoading}
                onClick={openPdf}
              >
                <Print aria-hidden="true" /> {t('presc.preview.previewPdf')}
              </button>
              <button
                type="button"
                className="m-btn primary"
                style={{ height: 44 }}
                disabled={!url || pdfLoading}
                onClick={downloadPdf}
              >
                <FileIcon aria-hidden="true" /> {t('presc.preview.download')}
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
                {t('presc.preview.preparingPdf')}
              </div>
            )}
          </>
        )}
      </div>
    </MScreen>
  );
}
