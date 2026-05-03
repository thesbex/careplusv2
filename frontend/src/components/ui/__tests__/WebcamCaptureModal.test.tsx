/**
 * WebcamCaptureModal — pin the desktop fallback path.
 *
 * Bug 2026-05-01 : sur PC, la modale demandait `facingMode: 'environment'`
 * en strict, ce que Chrome desktop interprète comme "il faut une caméra
 * arrière" → NotFoundError même quand la webcam frontale existe →
 * "Aucune caméra détectée" alors qu'il y en a une.
 *
 * Tests :
 *   1. Si getUserMedia accepte la 1ère contrainte (`ideal: environment`),
 *      on n'appelle JAMAIS le fallback.
 *   2. Si la 1ère contrainte renvoie OverconstrainedError, on retombe
 *      sur `{ video: true }` et on récupère un flux.
 *   3. NotAllowedError n'est PAS retryé (le user doit agir).
 *   4. NotReadableError affiche le bon message FR.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WebcamCaptureModal } from '../WebcamCaptureModal';

function fakeStream() {
  return {
    getTracks: () => [{ stop: () => {} }],
  } as unknown as MediaStream;
}

describe('<WebcamCaptureModal />', () => {
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. uses primary constraint when getUserMedia accepts it', async () => {
    getUserMedia.mockResolvedValueOnce(fakeStream());

    render(<WebcamCaptureModal open onCapture={() => {}} onClose={() => {}} />);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    expect(getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          facingMode: expect.objectContaining({ ideal: 'environment' }),
        }),
      }),
    );
  });

  it('2. falls back to { video: true } when primary throws OverconstrainedError', async () => {
    const overconstrained = new DOMException('overconstrained', 'OverconstrainedError');
    getUserMedia.mockRejectedValueOnce(overconstrained);
    getUserMedia.mockResolvedValueOnce(fakeStream());

    render(<WebcamCaptureModal open onCapture={() => {}} onClose={() => {}} />);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    // 2nd call must be the unconstrained fallback.
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: true, audio: false });
    // No error message should be visible — fallback succeeded.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('3. falls back when primary throws NotFoundError (PC desktop with one frontal cam)', async () => {
    const notFound = new DOMException('no rear cam', 'NotFoundError');
    getUserMedia.mockRejectedValueOnce(notFound);
    getUserMedia.mockResolvedValueOnce(fakeStream());

    render(<WebcamCaptureModal open onCapture={() => {}} onClose={() => {}} />);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia).toHaveBeenLastCalledWith({ video: true, audio: false });
    expect(screen.queryByText(/Aucune caméra détectée/)).not.toBeInTheDocument();
  });

  it('4. does NOT retry on NotAllowedError — surfaces permission message', async () => {
    const notAllowed = new DOMException('denied', 'NotAllowedError');
    getUserMedia.mockRejectedValueOnce(notAllowed);

    render(<WebcamCaptureModal open onCapture={() => {}} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/Permission caméra refusée/);
    // Critical: no second call — retrying a denied permission spams the prompt.
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('5. shows "occupée" message on NotReadableError without retrying', async () => {
    const busy = new DOMException('busy', 'NotReadableError');
    getUserMedia.mockRejectedValueOnce(busy);

    render(<WebcamCaptureModal open onCapture={() => {}} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent(/utilisée par une autre application/);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('6. shows final error message when even the fallback fails', async () => {
    const overconstrained = new DOMException('overconstrained', 'OverconstrainedError');
    const stillNotFound = new DOMException('really none', 'NotFoundError');
    getUserMedia.mockRejectedValueOnce(overconstrained);
    getUserMedia.mockRejectedValueOnce(stillNotFound);

    render(<WebcamCaptureModal open onCapture={() => {}} onClose={() => {}} />);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('alert')).toHaveTextContent(/Aucune caméra détectée/);
  });
});
