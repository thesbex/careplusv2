/**
 * PrescriptionResultsPanel — un seul bouton « Téléverser résultat » par
 * ordonnance LAB / IMAGING (V015).
 *
 * Workflow réel : le patient revient avec UN dossier (un PDF / une enveloppe)
 * du laboratoire ou du radiologue, peu importe le nombre de lignes prescrites.
 * On ancre donc l'upload sur une seule ligne (la première qui a déjà un
 * résultat, sinon la première ligne tout court) et on n'expose qu'un bouton.
 *
 * Ne se monte que si `prescription.type` est LAB ou IMAGING (DRUG n'a pas de
 * résultat — l'API renverrait sinon 400 RESULT_NOT_APPLICABLE).
 */
import { PrescriptionLineResultButton } from './PrescriptionLineResultButton';
import type { PrescriptionApi } from '../types';

interface Props {
  prescription: PrescriptionApi;
  /** Désactive l'upload (consultation signée + côté droits utilisateur). */
  readOnly?: boolean;
}

export function PrescriptionResultsPanel({ prescription, readOnly = false }: Props) {
  const isResultable = prescription.type === 'LAB' || prescription.type === 'IMAGING';
  if (!isResultable) return null;
  if (prescription.lines.length === 0) return null;

  const lineWithResult = prescription.lines.find((l) => l.resultDocumentId);
  const anchor = lineWithResult ?? prescription.lines[0]!;

  return (
    <div
      data-testid="prescription-results-panel"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: '8px 12px',
        background: 'var(--surface-2, rgba(0,0,0,0.02))',
        borderRadius: 8,
        marginTop: 6,
      }}
    >
      <PrescriptionLineResultButton
        lineId={anchor.id}
        resultDocumentId={anchor.resultDocumentId}
        disabled={readOnly}
      />
    </div>
  );
}
