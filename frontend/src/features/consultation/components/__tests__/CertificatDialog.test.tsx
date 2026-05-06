/**
 * CertificatDialog tests — F10 :
 *   - Modèle "Repos" → champs jours / date début / sortie autorisée apparaissent
 *   - Validation : bouton désactivé si jours < 1 ou jours > 30
 *   - Date de fin = début + jours - 1 (inclus)
 *   - Payload POST contient le texte structuré (jours + dates) au lieu de "…"
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CertificatDialog } from '../CertificatDialog';

const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/lib/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderDialog() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CertificatDialog
        open={true}
        onOpenChange={vi.fn()}
        consultationId="cons-1"
        onCreated={vi.fn()}
      />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  // jsdom n'a pas createObjectURL — on stub.
  if (!('createObjectURL' in URL)) {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:mock'),
    });
  }
  // Empêche jsdom d'ouvrir une fenêtre dans onSuccess.
  window.open = vi.fn() as unknown as typeof window.open;
});

describe('<CertificatDialog /> — F10 modèle Repos', () => {
  it('affiche les champs structurés quand le modèle "Repos" est sélectionné', async () => {
    const user = userEvent.setup();
    renderDialog();

    // Pas de champs avant choix
    expect(screen.queryByTestId('rest-fields')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Modèle : Repos/i }));

    expect(screen.getByTestId('rest-fields')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre de jours de repos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date de début du repos/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sortie autorisée/i)).toBeInTheDocument();
  });

  it('désactive le bouton "Générer" si jours = 0 ou jours > 30', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /Modèle : Repos/i }));

    const days = screen.getByLabelText(/Nombre de jours de repos/i) as HTMLInputElement;
    const generate = screen.getByRole('button', { name: /Générer le certificat/i }) as HTMLButtonElement;

    // Cas valide initial → enabled
    expect(generate.disabled).toBe(false);

    // jours = 0 → désactivé
    await user.clear(days);
    await user.type(days, '0');
    expect(generate.disabled).toBe(true);

    // jours = 35 → désactivé
    await user.clear(days);
    await user.type(days, '35');
    expect(generate.disabled).toBe(true);

    // jours = 5 → réactivé
    await user.clear(days);
    await user.type(days, '5');
    expect(generate.disabled).toBe(false);
  });

  it('calcule date de fin = début + jours - 1 (inclus)', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /Modèle : Repos/i }));

    const days = screen.getByLabelText(/Nombre de jours de repos/i);
    const start = screen.getByLabelText(/Date de début du repos/i);

    await user.clear(start);
    await user.type(start, '2026-05-10');
    await user.clear(days);
    await user.type(days, '5');

    // 5 jours du 10 au 14 inclus
    expect(screen.getByTestId('rest-end-preview')).toHaveTextContent('14/05/2026');
  });

  it('envoie un payload avec body structuré (jours + dates) sans placeholder "…"', async () => {
    mockPost.mockResolvedValue({ data: { id: 'presc-1' } });
    mockGet.mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) });

    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /Modèle : Repos/i }));

    const days = screen.getByLabelText(/Nombre de jours de repos/i);
    const start = screen.getByLabelText(/Date de début du repos/i);

    await user.clear(start);
    await user.type(start, '2026-05-10');
    await user.clear(days);
    await user.type(days, '5');

    await user.click(screen.getByRole('button', { name: /Générer le certificat/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const call = mockPost.mock.calls[0]!;
    const payload = call[1] as { lines: { freeText: string }[] };
    const body = payload.lines[0]!.freeText;
    expect(body).toContain('5 jours');
    expect(body).toContain('10/05/2026');
    expect(body).toContain('14/05/2026');
    expect(body).toContain('Sortie autorisée');
    expect(body).not.toContain('…');
  });

  it('décoche "Sortie autorisée" → texte mis à jour', async () => {
    mockPost.mockResolvedValue({ data: { id: 'presc-1' } });
    mockGet.mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) });

    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /Modèle : Repos/i }));
    await user.click(screen.getByLabelText(/Sortie autorisée/i));

    await user.click(screen.getByRole('button', { name: /Générer le certificat/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const call = mockPost.mock.calls[0]!;
    const payload = call[1] as { lines: { freeText: string }[] };
    expect(payload.lines[0]!.freeText).toContain('Sortie non autorisée');
  });
});
