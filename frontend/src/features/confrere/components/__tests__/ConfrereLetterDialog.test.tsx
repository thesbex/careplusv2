/**
 * ConfrereLetterDialog tests — QA9-10 :
 *   - rend la modale (titre + champs destinataire / corps)
 *   - sélectionner un confrère du carnet préremplit nom / spécialité / ville
 *   - "Générer & imprimer" POST avec recipientName + body (+ champs optionnels)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfrereLetterDialog } from '../ConfrereLetterDialog';

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

const mockContacts = [
  {
    id: 'ref-1',
    fullName: 'Dr. Amine Bennani',
    specialty: 'Cardiologie',
    phone: null,
    city: 'Casablanca',
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

vi.mock('@/features/profil/hooks/useReferralContacts', () => ({
  useReferralContacts: () => ({ contacts: mockContacts, isLoading: false, error: null }),
}));

function renderDialog() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <ConfrereLetterDialog open={true} onOpenChange={vi.fn()} consultationId="cons-1" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  if (!('createObjectURL' in URL)) {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:mock'),
    });
  }
  if (!('revokeObjectURL' in URL)) {
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  }
  window.open = vi.fn() as unknown as typeof window.open;
});

describe('<ConfrereLetterDialog /> — QA9-10', () => {
  it('rend la modale avec le destinataire et le corps', () => {
    renderDialog();
    expect(screen.getByText('Courrier au confrère')).toBeInTheDocument();
    expect(screen.getByLabelText(/Nom du destinataire/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Corps du courrier/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Générer & imprimer/i })).toBeInTheDocument();
  });

  it('préremplit le destinataire en sélectionnant un confrère du carnet', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText(/Confrère du carnet/i), 'ref-1');

    expect((screen.getByLabelText(/Nom du destinataire/i) as HTMLInputElement).value).toBe(
      'Dr. Amine Bennani',
    );
    expect((screen.getByLabelText(/Spécialité du destinataire/i) as HTMLInputElement).value).toBe(
      'Cardiologie',
    );
    expect((screen.getByLabelText(/Ville du destinataire/i) as HTMLInputElement).value).toBe(
      'Casablanca',
    );
  });

  it('"Générer" appelle la mutation avec recipientName + body', async () => {
    mockPost.mockResolvedValue({ data: { documentId: 'doc-1' } });
    mockGet.mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) });

    const user = userEvent.setup();
    renderDialog();

    await user.selectOptions(screen.getByLabelText(/Confrère du carnet/i), 'ref-1');
    await user.type(
      screen.getByLabelText(/Corps du courrier/i),
      'Je vous adresse ce patient pour avis cardiologique.',
    );

    await user.click(screen.getByRole('button', { name: /Générer & imprimer/i }));

    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    const call = mockPost.mock.calls[0]!;
    expect(call[0]).toBe('/consultations/cons-1/confrere-letter');
    const payload = call[1] as {
      recipientName: string;
      recipientSpecialty?: string;
      recipientCity?: string;
      body: string;
    };
    expect(payload.recipientName).toBe('Dr. Amine Bennani');
    expect(payload.recipientSpecialty).toBe('Cardiologie');
    expect(payload.recipientCity).toBe('Casablanca');
    expect(payload.body).toContain('avis cardiologique');

    // PDF téléchargé via le mécanisme blob (GET /documents/{id}/content).
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith('/documents/doc-1/content', { responseType: 'blob' }));
  });

  it('bloque la génération si le destinataire est vide', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText(/Corps du courrier/i), 'Un corps suffisamment long.');
    await user.click(screen.getByRole('button', { name: /Générer & imprimer/i }));

    expect(mockPost).not.toHaveBeenCalled();
  });
});
