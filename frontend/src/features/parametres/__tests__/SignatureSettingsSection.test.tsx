/**
 * F16 — SignatureSettingsSection (paramétrage cabinet, onglet Cabinet).
 *
 * Pin :
 *   1. ADMIN voit la section "vide" quand aucune signature n'est configurée.
 *   2. Non-ADMIN ne voit rien (composant retourne null).
 *   3. Upload PNG → PUT /settings/signature multipart envoyé.
 *   4. Refus client si MIME non autorisé (txt) — pas de PUT.
 *   5. Refus client si taille > 500 Ko — pas de PUT.
 *   6. Bouton Supprimer visible quand meta != null, déclenche DELETE après confirm.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/auth/authStore', () => {
  const state = { user: { roles: ['ADMIN'] } as { roles: string[] } | null };
  const useAuthStore = ((selector: (s: typeof state) => unknown) => selector(state)) as unknown as {
    (selector: (s: typeof state) => unknown): unknown;
  };
  return { useAuthStore, __setUser: (u: { roles: string[] } | null) => { state.user = u; } };
});

// jsdom n'a pas confirm() — on l'auto-OK.
beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  // Stub URL.createObjectURL — pas dispo dans jsdom.
  if (!URL.createObjectURL) {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:mock-url'),
      configurable: true,
    });
  }
});

import { api } from '@/lib/api/client';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const authMod = (await import('@/lib/auth/authStore')) as any;
import { SignatureSettingsSection } from '../components/SignatureSettingsSection';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  authMod.__setUser({ roles: ['ADMIN'] });
  // Default : pas de signature.
  apiMock.get.mockImplementation((url: string) => {
    if (url === '/settings/signature/meta') {
      return Promise.resolve({ status: 204, data: null });
    }
    return Promise.resolve({ status: 204, data: null });
  });
});

describe('SignatureSettingsSection', () => {
  it('1. ADMIN voit l\'état vide', async () => {
    render(withClient(<SignatureSettingsSection />));
    await waitFor(() => {
      expect(screen.getByText(/Aucune signature configurée/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Téléverser/i })).toBeInTheDocument();
  });

  it('2. Non-ADMIN ne voit rien', () => {
    authMod.__setUser({ roles: ['MEDECIN'] });
    const { container } = render(withClient(<SignatureSettingsSection />));
    expect(container.firstChild).toBeNull();
  });

  it('3. Upload PNG envoie PUT /settings/signature multipart', async () => {
    const meta = { mime: 'image/png', uploadedAt: '2026-05-06T10:00:00Z', sizeBytes: 1234 };
    apiMock.put.mockResolvedValue({ data: meta });

    render(withClient(<SignatureSettingsSection />));
    await screen.findByText(/Aucune signature/i);

    const input = screen.getByTestId('signature-file-input') as HTMLInputElement;
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'sig.png', {
      type: 'image/png',
    });

    // Simule la sélection de fichier (jsdom n'a pas File.input nativement)
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(apiMock.put).toHaveBeenCalled());
    const [url, body, opts] = apiMock.put.mock.calls[0]!;
    expect(url).toBe('/settings/signature');
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get('file')).toBeInstanceOf(File);
    expect((opts as { headers: Record<string, string> }).headers['Content-Type'])
      .toBe('multipart/form-data');
  });

  it('4. Refuse côté client un fichier .txt (pas de PUT)', async () => {
    render(withClient(<SignatureSettingsSection />));
    await screen.findByText(/Aucune signature/i);

    const input = screen.getByTestId('signature-file-input') as HTMLInputElement;
    const file = new File(['hello'], 'sig.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => {
      expect(screen.getByText(/Format non autorisé/i)).toBeInTheDocument();
    });
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('5. Refuse côté client un fichier > 500 Ko', async () => {
    render(withClient(<SignatureSettingsSection />));
    await screen.findByText(/Aucune signature/i);

    const input = screen.getByTestId('signature-file-input') as HTMLInputElement;
    const big = new File([new Uint8Array(600 * 1024)], 'big.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [big] });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => {
      expect(screen.getByText(/trop volumineuse/i)).toBeInTheDocument();
    });
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('6. Bouton Supprimer présent + DELETE envoyé quand meta != null', async () => {
    const meta = { mime: 'image/png', uploadedAt: '2026-05-06T10:00:00Z', sizeBytes: 4321 };
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/settings/signature/meta') {
        return Promise.resolve({ status: 200, data: meta });
      }
      if (url === '/settings/signature') {
        return Promise.resolve({ status: 200, data: new Blob([new Uint8Array([1, 2, 3])]) });
      }
      return Promise.resolve({ status: 204, data: null });
    });
    apiMock.delete.mockResolvedValue({ data: undefined });

    render(withClient(<SignatureSettingsSection />));
    const removeBtn = await screen.findByRole('button', { name: /Supprimer/i });
    removeBtn.click();
    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/settings/signature'));
  });
});
