/**
 * PrescriptionResultsPanel — affiche les lignes d'une prescription
 * LAB / IMAGING avec un bouton « Téléverser résultat » par ligne (V015).
 *
 * Ne se monte que si `prescription.type` est LAB ou IMAGING (DRUG n'a
 * pas de résultat — l'API renverrait sinon 400 RESULT_NOT_APPLICABLE).
 */
import { PrescriptionLineResultButton } from './PrescriptionLineResultButton';
import type { PrescriptionApi, PrescriptionLineApi } from '../types';

interface Props {
  prescription: PrescriptionApi;
  /** Désactive l'upload (consultation signée + côté droits utilisateur). */
  readOnly?: boolean;
}

function lineLabel(line: PrescriptionLineApi): string {
  if (line.freeText) return line.freeText;
  if (line.labTestId) return `Analyse #${line.labTestId.slice(0, 8).toUpperCase()}`;
  if (line.imagingExamId) return `Imagerie #${line.imagingExamId.slice(0, 8).toUpperCase()}`;
  return 'Ligne';
}

export function PrescriptionResultsPanel({ prescription, readOnly = false }: Props) {
  const isResultable = prescription.type === 'LAB' || prescription.type === 'IMAGING';
  if (!isResultable) return null;
  if (prescription.lines.length === 0) return null;

  return (
    <div
      data-testid="prescription-results-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 12px',
        background: 'var(--surface-2, rgba(0,0,0,0.02))',
        borderRadius: 8,
        marginTop: 6,
      }}
    >
      {prescription.lines.map((line) => (
        <div
          key={line.id}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
          }}
        >
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lineLabel(line)}
            {line.instructions && (
              <span style={{ color: 'var(--ink-3)', marginLeft: 6 }}>· {line.instructions}</span>
            )}
          </span>
          <PrescriptionLineResultButton
            lineId={line.id}
            resultDocumentId={line.resultDocumentId}
            disabled={readOnly}
          />
        </div>
      ))}
    </div>
  );
}
