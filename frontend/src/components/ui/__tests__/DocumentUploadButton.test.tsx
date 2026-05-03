/**
 * DocumentUploadButton — branchement desktop vs mobile.
 *
 * Bug d'origine (Y. Boutaleb 2026-05-01) : sur PC, « Photographier »
 * ouvrait le picker fichier au lieu de la webcam parce que
 * `capture="environment"` est ignoré par les navigateurs desktop.
 *
 * Ces tests pinnent le contrat :
 *   - desktop (pointer fin) → click déclenche la modale getUserMedia
 *     (présence d'un dialog `aria-label="Capture caméra"`).
 *   - mobile (pointer coarse + touch) → click déclenche le file
 *     input `capture="environment"` (pas de modale).
 *   - upload classique → file picker, jamais de modale ni de capture.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DocumentUploadButton } from '../DocumentUploadButton';

function setMediaQuery(coarse: boolean) {
  // jsdom n'implémente pas matchMedia — on fournit un stub.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (q: string) => ({
      matches: q.includes('coarse') ? coarse : false,
      media: q,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

function setTouch(maxTouchPoints: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', {
    configurable: true,
    value: maxTouchPoints,
  });
}

describe('DocumentUploadButton', () => {
  beforeEach(() => {
    // Default to desktop (no coarse pointer, no touch).
    setMediaQuery(false);
    setTouch(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('desktop : click sur « Photographier » ouvre la modale webcam (pas le picker)', async () => {
    const onFile = vi.fn();
    render(<DocumentUploadButton onFile={onFile} />);

    await userEvent.click(screen.getByRole('button', { name: /Photographier/i }));

    expect(await screen.findByRole('dialog', { name: 'Capture caméra' })).toBeInTheDocument();
    expect(onFile).not.toHaveBeenCalled();
  });

  it('mobile : click sur « Photographier » N\'OUVRE PAS la modale (l\'input capture s\'en charge)', async () => {
    setMediaQuery(true);
    setTouch(5);
    const onFile = vi.fn();
    render(<DocumentUploadButton onFile={onFile} />);

    await userEvent.click(screen.getByRole('button', { name: /Photographier/i }));

    expect(screen.queryByRole('dialog', { name: 'Capture caméra' })).not.toBeInTheDocument();
  });

  it('« Téléverser » n\'ouvre jamais la modale, quel que soit le device', async () => {
    const onFile = vi.fn();
    render(<DocumentUploadButton onFile={onFile} />);

    await userEvent.click(screen.getByRole('button', { name: /Téléverser/i }));

    expect(screen.queryByRole('dialog', { name: 'Capture caméra' })).not.toBeInTheDocument();
  });

  it('input caméra mobile garde capture="environment" pour ouvrir l\'app caméra système', () => {
    const { container } = render(<DocumentUploadButton onFile={vi.fn()} />);
    const camInput = container.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    expect(camInput).toBeTruthy();
    expect(camInput.getAttribute('capture')).toBe('environment');
  });

  it('cameraOnly : seul le bouton Photographier est rendu', () => {
    render(<DocumentUploadButton cameraOnly onFile={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Téléverser/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Photographier/i })).toBeInTheDocument();
  });

  it('uploadOnly : seul le bouton Téléverser est rendu', () => {
    render(<DocumentUploadButton uploadOnly onFile={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Téléverser/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Photographier/i })).not.toBeInTheDocument();
  });
});
