/**
 * F9 — Loader pendant génération PDF.
 *
 * Pinne le contrat UI :
 *   1. masqué quand `open=false`
 *   2. visible quand `open=true` avec role="status" pour accessibilité
 *      (aria-live="polite" + lecteurs d'écran annoncent le changement)
 *   3. libellé varie selon `type` (Certificat / Ordonnance / Bon
 *      d'analyses / Bon d'imagerie / Arrêt de travail)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PdfGenerationOverlay } from '../components/PdfGenerationOverlay';

describe('PdfGenerationOverlay', () => {
  it('renders the status overlay when open=true and stays hidden when open=false', () => {
    const { rerender, container } = render(<PdfGenerationOverlay open={false} type="CERT" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();

    rerender(<PdfGenerationOverlay open={true} type="CERT" />);
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toContain('Cela peut prendre quelques secondes');
  });

  it('shows a label that varies with the prescription type', () => {
    const cases = [
      { type: 'CERT' as const, expected: 'Certificat' },
      { type: 'DRUG' as const, expected: "l'Ordonnance" },
      { type: 'LAB' as const, expected: "Bon d'analyses" },
      { type: 'IMAGING' as const, expected: "Bon d'imagerie" },
      { type: 'SICK_LEAVE' as const, expected: "l'Arrêt de travail" },
    ];
    for (const { type, expected } of cases) {
      const { unmount } = render(<PdfGenerationOverlay open={true} type={type} />);
      expect(
        screen.getByRole('status').textContent,
        `type=${type} should mention "${expected}"`,
      ).toContain(expected);
      unmount();
    }
  });

  it('falls back to a generic label when type is undefined', () => {
    render(<PdfGenerationOverlay open={true} />);
    expect(screen.getByRole('status').textContent).toContain('Génération du document en cours…');
  });
});
