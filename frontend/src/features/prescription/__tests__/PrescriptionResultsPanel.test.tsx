/**
 * PrescriptionResultsPanel — affichage des lignes LAB/IMAGING avec
 * bouton « Téléverser résultat » (V015).
 *
 * Pinne le contrat :
 *   - DRUG : panneau invisible (RESULT_NOT_APPLICABLE backend).
 *   - LAB / IMAGING : une ligne rendue par PrescriptionLineApi.
 *   - Si resultDocumentId présent : lien « Voir résultat » qui pointe
 *     bien sur /api/documents/{id}/content.
 *   - Si null : DocumentUploadButton est rendu (Téléverser + Photographier).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrescriptionResultsPanel } from '../components/PrescriptionResultsPanel';
import type { PrescriptionApi } from '../types';

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

const baseLine = {
  id: 'l1',
  medicationId: null,
  labTestId: null,
  imagingExamId: null,
  freeText: null,
  dosage: null,
  frequency: null,
  duration: null,
  route: null,
  timing: null,
  quantity: null,
  instructions: null,
  sortOrder: 0,
  resultDocumentId: null,
};

function rx(over: Partial<PrescriptionApi>): PrescriptionApi {
  return {
    id: 'p1',
    consultationId: 'c1',
    patientId: 'pat1',
    type: 'LAB',
    issuedAt: '2026-05-01T10:00:00Z',
    lines: [],
    allergyOverride: false,
    ...over,
  };
}

describe('PrescriptionResultsPanel', () => {
  it('DRUG : ne rend rien (la prescription médicament n\'a pas de résultat)', () => {
    const { container } = render(
      withClient(
        <PrescriptionResultsPanel
          prescription={rx({ type: 'DRUG', lines: [{ ...baseLine, medicationId: 'm1' }] })}
        />,
      ),
    );
    expect(container.querySelector('[data-testid="prescription-results-panel"]')).toBeNull();
  });

  it('LAB sans résultat : affiche bouton « Téléverser résultat »', () => {
    render(
      withClient(
        <PrescriptionResultsPanel
          prescription={rx({
            type: 'LAB',
            lines: [{ ...baseLine, labTestId: 'lab1', freeText: 'Glycémie' }],
          })}
        />,
      ),
    );
    expect(screen.getByRole('button', { name: /Téléverser résultat/i })).toBeInTheDocument();
    expect(screen.queryByText(/Voir résultat/i)).not.toBeInTheDocument();
    expect(screen.getByText('Glycémie')).toBeInTheDocument();
  });

  it('LAB avec résultat : affiche lien « Voir résultat » vers /api/documents/{id}/content', () => {
    render(
      withClient(
        <PrescriptionResultsPanel
          prescription={rx({
            type: 'LAB',
            lines: [{ ...baseLine, labTestId: 'lab1', freeText: 'Bilan lipidique', resultDocumentId: 'doc-uuid-xyz' }],
          })}
        />,
      ),
    );
    const link = screen.getByRole('link', { name: /Voir résultat/i });
    expect(link).toHaveAttribute('href', '/api/documents/doc-uuid-xyz/content');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('readOnly : pas de bouton de suppression sur une ligne avec résultat', () => {
    render(
      withClient(
        <PrescriptionResultsPanel
          readOnly
          prescription={rx({
            type: 'IMAGING',
            lines: [{ ...baseLine, imagingExamId: 'img1', resultDocumentId: 'doc-1' }],
          })}
        />,
      ),
    );
    expect(screen.queryByRole('button', { name: /Retirer le résultat/i })).not.toBeInTheDocument();
  });

  it('IMAGING : panneau présent (pas seulement LAB)', () => {
    render(
      withClient(
        <PrescriptionResultsPanel
          prescription={rx({
            type: 'IMAGING',
            lines: [{ ...baseLine, imagingExamId: 'img1', freeText: 'Radio thorax' }],
          })}
        />,
      ),
    );
    expect(screen.getByTestId('prescription-results-panel')).toBeInTheDocument();
    expect(screen.getByText('Radio thorax')).toBeInTheDocument();
  });
});
