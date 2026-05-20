/**
 * Régression bugs B2/B3/B4 — "Documents générés" (mai 2026).
 *
 * B2 — Mauvais routing/typage des certificats : la page d'aperçu hardcodait
 *      "Aperçu — Ordonnance" / préfixe ORD- pour TOUS les types. Un
 *      certificat (type=CERT) apparaissait donc avec le titre "Ordonnance"
 *      et le préfixe ORD-. Idem pour le libellé en rubrique "Documents
 *      générés" du formulaire de consultation.
 *
 * B3 — Aperçu PDF inline cassé : l'iframe ne pouvait pas charger l'URL
 *      `/api/prescriptions/:id/pdf` directement (auth Bearer en mémoire,
 *      ADR-019, pas de cookie d'auth). Le fix passe par un fetch axios qui
 *      attache le bearer puis crée une `URL.createObjectURL` rendue dans
 *      l'iframe.
 *
 * B4 — Boutons Télécharger / Imprimer sans effet : ils tapaient l'endpoint
 *      protégé sans auth → 401 silencieux. Le fix réutilise la même blob URL
 *      via `<a href download>` programmatique et `iframe.contentWindow.print()`.
 *
 * Ces tests pinnent les contrats UI :
 *   1. titre/préfixe/filename adaptent au type (DRUG/LAB/IMAGING/CERT/SICK_LEAVE)
 *   2. la page récupère le PDF via axios et injecte la blob URL dans l'iframe
 *   3. le bouton Télécharger crée un <a download> avec un filename type-aware
 *   4. le bouton Imprimer appelle iframe.contentWindow.print()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { metaForPrescription } from '../components/DocumentPdfViewer';
import type { PrescriptionApi } from '../types';

// ── Module-level mocks ──────────────────────────────────────────────────────

const apiGetMock = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

// ── Test fixtures ───────────────────────────────────────────────────────────

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
  resultText: null,
};

function rx(over: Partial<PrescriptionApi>): PrescriptionApi {
  return {
    id: 'p1',
    consultationId: 'c1',
    patientId: 'pat1',
    type: 'DRUG',
    issuedAt: '2026-05-06T10:00:00Z',
    lines: [{ ...baseLine }],
    allergyOverride: false,
    ...over,
  };
}

const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]).buffer; // "%PDF-"

beforeEach(() => {
  apiGetMock.mockReset();
  // Default : prescription GET, then PDF GET. Test peut override.
  apiGetMock.mockImplementation((url: string, opts?: { responseType?: string }) => {
    if (url.endsWith('/pdf')) {
      return Promise.resolve({ data: PDF_BYTES, headers: {}, status: 200, config: opts });
    }
    return Promise.resolve({
      data: rx({ id: 'p1', type: 'CERT' }),
      headers: {},
      status: 200,
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// jsdom n'implémente pas URL.createObjectURL : on stub.
beforeEach(() => {
  let counter = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock-url-${++counter}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});

// ── metaForPrescription — pure unit ──────────────────────────────────────────

describe('metaForPrescription — type-aware labels (bug B2)', () => {
  it('DRUG → Ordonnance / ORD / ordonnance', () => {
    expect(metaForPrescription(rx({ type: 'DRUG' }))).toEqual({
      prefix: 'ORD',
      label: 'Ordonnance',
      fileSlug: 'ordonnance',
    });
  });

  it('CERT → Certificat / CERT / certificat (PAS Ordonnance / PAS ORD)', () => {
    const meta = metaForPrescription(rx({ type: 'CERT' }));
    expect(meta.label).toBe('Certificat');
    expect(meta.prefix).toBe('CERT');
    expect(meta.fileSlug).toBe('certificat');
    expect(meta.label).not.toBe('Ordonnance');
    expect(meta.prefix).not.toBe('ORD');
  });

  it('SICK_LEAVE → Arrêt de travail / AT', () => {
    expect(metaForPrescription(rx({ type: 'SICK_LEAVE' }))).toEqual({
      prefix: 'AT',
      label: 'Arrêt de travail',
      fileSlug: 'arret-travail',
    });
  });

  it('LAB → Bon d\'analyses / BON', () => {
    const meta = metaForPrescription(rx({ type: 'LAB' }));
    expect(meta.label).toBe("Bon d'analyses");
    expect(meta.prefix).toBe('BON');
  });

  it('IMAGING → Bon d\'imagerie / BON', () => {
    const meta = metaForPrescription(rx({ type: 'IMAGING' }));
    expect(meta.label).toBe("Bon d'imagerie");
    expect(meta.prefix).toBe('BON');
  });

  it('null/undefined → Document neutre (jamais "Ordonnance" par défaut)', () => {
    expect(metaForPrescription(null).label).toBe('Document');
    expect(metaForPrescription(undefined).label).toBe('Document');
  });
});

// ── OrdonnancePdfPage walk-through ──────────────────────────────────────────

import OrdonnancePdfPage from '../OrdonnancePdfPage';

function renderPdfPage(prescriptionId = 'p1') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/prescriptions/:id', element: <OrdonnancePdfPage /> },
      { path: '/agenda', element: <div>Agenda</div> },
      { path: '/consultations', element: <div>Consultations</div> },
    ],
    { initialEntries: [`/prescriptions/${prescriptionId}`] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<OrdonnancePdfPage /> — bug B2 (titre/préfixe type-aware)', () => {
  it('CERT : affiche "Aperçu — Certificat" et préfixe CERT-… (PAS Ordonnance / PAS ORD-)', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/pdf')) {
        return Promise.resolve({ data: PDF_BYTES, headers: {}, status: 200 });
      }
      return Promise.resolve({
        data: rx({ id: 'p1', type: 'CERT', issuedAt: '2026-05-06T10:00:00Z' }),
        headers: {},
        status: 200,
      });
    });

    renderPdfPage('p1');

    await waitFor(() => {
      const title = document.querySelector('.cp-topbar-title');
      expect(title?.textContent).toBe('Aperçu — Certificat');
    });
    const sub = document.querySelector('.cp-topbar-sub');
    expect(sub?.textContent).toContain('CERT-P1');
    expect(sub?.textContent).not.toContain('ORD-');
  });

  it('DRUG : titre "Aperçu — Ordonnance" préservé (régression croisée)', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/pdf')) {
        return Promise.resolve({ data: PDF_BYTES, headers: {}, status: 200 });
      }
      return Promise.resolve({
        data: rx({ id: 'p1', type: 'DRUG' }),
        headers: {},
        status: 200,
      });
    });
    renderPdfPage('p1');
    await waitFor(() => {
      expect(document.querySelector('.cp-topbar-title')?.textContent).toBe(
        'Aperçu — Ordonnance',
      );
    });
    expect(document.querySelector('.cp-topbar-sub')?.textContent).toContain('ORD-P1');
  });
});

describe('<OrdonnancePdfPage /> — bug B3 (PDF blob inline)', () => {
  it('appelle GET /prescriptions/:id/pdf en arraybuffer (auth bearer attaché par axios)', async () => {
    renderPdfPage('p1');
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(
        '/prescriptions/p1/pdf',
        expect.objectContaining({ responseType: 'arraybuffer' }),
      );
    });
  });

  it('crée une URL.createObjectURL et la pose dans <iframe src> (pas l\'URL backend)', async () => {
    renderPdfPage('p1');
    await waitFor(() => {
      const iframe = document.querySelector('iframe.pr-pdf-viewer') as HTMLIFrameElement | null;
      expect(iframe).not.toBeNull();
      // Le src doit être une blob: URL — pas /api/prescriptions/p1/pdf.
      expect(iframe?.src).toMatch(/^blob:/);
      expect(iframe?.src).not.toContain('/api/prescriptions/');
    });
    expect(globalThis.URL.createObjectURL).toHaveBeenCalledTimes(1);
  });

  it('rend "Impossible de charger le PDF" si le fetch échoue', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/pdf')) return Promise.reject(new Error('401 unauthorized'));
      return Promise.resolve({
        data: rx({ id: 'p1', type: 'DRUG' }),
        headers: {},
        status: 200,
      });
    });
    renderPdfPage('p1');
    await waitFor(() => {
      expect(screen.getByText('Impossible de charger le PDF.')).toBeInTheDocument();
    });
  });
});

describe('<OrdonnancePdfPage /> — bug B4 (download / print)', () => {
  it('Télécharger : crée un <a href=blob: download="<slug>-<id>.pdf"> et clique', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/pdf')) {
        return Promise.resolve({ data: PDF_BYTES, headers: {}, status: 200 });
      }
      return Promise.resolve({
        data: rx({ id: 'p1', type: 'CERT' }),
        headers: {},
        status: 200,
      });
    });

    const user = userEvent.setup();
    renderPdfPage('p1');
    // Wait for blob URL ready
    await waitFor(() => {
      expect(document.querySelector('iframe.pr-pdf-viewer')).not.toBeNull();
    });

    // Espionne la création d'<a> pour capturer href + download.
    const realCreate = document.createElement.bind(document);
    let capturedAnchor: HTMLAnchorElement | null = null;
    const createSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag) as HTMLElement;
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
      }
      return el;
    });

    await user.click(screen.getByRole('button', { name: /Télécharger/i }));

    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.href).toMatch(/^blob:/);
    expect(capturedAnchor!.download).toBe('certificat-P1.pdf');

    createSpy.mockRestore();
  });

  it('Imprimer : appelle iframe.contentWindow.print()', async () => {
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/pdf')) {
        return Promise.resolve({ data: PDF_BYTES, headers: {}, status: 200 });
      }
      return Promise.resolve({
        data: rx({ id: 'p1', type: 'DRUG' }),
        headers: {},
        status: 200,
      });
    });

    const user = userEvent.setup();
    renderPdfPage('p1');
    await waitFor(() => {
      expect(document.querySelector('iframe.pr-pdf-viewer')).not.toBeNull();
    });

    const iframe = document.querySelector('iframe.pr-pdf-viewer') as HTMLIFrameElement;
    const printSpy = vi.fn();
    const focusSpy = vi.fn();
    // jsdom autorise contentWindow mais pas print() ; on stub.
    Object.defineProperty(iframe, 'contentWindow', {
      configurable: true,
      get: () => ({ print: printSpy, focus: focusSpy }),
    });

    await user.click(screen.getByRole('button', { name: /Imprimer/i }));

    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('Boutons Télécharger / Imprimer désactivés tant que le PDF n\'est pas chargé', async () => {
    let resolvePdf: (value: { data: ArrayBuffer; headers: Record<string, never>; status: number }) => void = () => {
      /* noop */
    };
    apiGetMock.mockImplementation((url: string) => {
      if (url.endsWith('/pdf')) {
        return new Promise((resolve) => {
          resolvePdf = resolve;
        });
      }
      return Promise.resolve({
        data: rx({ id: 'p1', type: 'DRUG' }),
        headers: {},
        status: 200,
      });
    });

    renderPdfPage('p1');

    // Avant que le PDF ne se charge, les deux boutons doivent être disabled.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Télécharger/i })).toBeDisabled();
    });
    expect(screen.getByRole('button', { name: /Imprimer/i })).toBeDisabled();

    // Une fois le blob prêt → boutons activés.
    resolvePdf({ data: PDF_BYTES, headers: {}, status: 200 });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Télécharger/i })).not.toBeDisabled();
    });
    expect(screen.getByRole('button', { name: /Imprimer/i })).not.toBeDisabled();
  });
});
