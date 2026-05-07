/**
 * UtilisateursTab — section "Médecins gérés" (V032).
 *
 * Pinne :
 *   1. Rôle MEDECIN sélectionné → section assignations absente.
 *   2. Rôle SECRETAIRE + 1 médecin actif (cabinet 1 médecin) → section absente.
 *   3. Rôle SECRETAIRE + 2+ médecins actifs → section présente.
 *   4. Submit avec sélection partielle → payload contient assignedPractitionerIds = [partiel].
 *   5. Edit user existant → pré-rempli avec assignedPractitionerIds renvoyés par GET /admin/users/{id}.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/lib/api/client', () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { api } from '@/lib/api/client';
import { UtilisateursTab } from '../components/UtilisateursTab';

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function withClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

const PRACTITIONERS_TWO = [
  { id: 'p1', firstName: 'Anas', lastName: 'El Amrani', specialty: 'Généraliste', active: true },
  { id: 'p2', firstName: 'Sofia', lastName: 'Bennani', specialty: 'Pédiatre', active: true },
];

const USERS_EMPTY: unknown[] = [];

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
});

function defaultGet(practitioners: unknown[], users: unknown[]) {
  return (url: string) => {
    if (url === '/admin/users') return Promise.resolve({ data: users });
    if (url === '/practitioners') return Promise.resolve({ data: practitioners });
    return Promise.resolve({ data: null });
  };
}

describe('UtilisateursTab — assignations practitioners (V032)', () => {
  it('1. rôle MEDECIN → section assignations absente', async () => {
    apiMock.get.mockImplementation(defaultGet(PRACTITIONERS_TWO, USERS_EMPTY));
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'MEDECIN');
    expect(screen.queryByTestId('user-assignment-section')).toBeNull();
  });

  it('2. SECRETAIRE + 1 médecin actif → section absente', async () => {
    apiMock.get.mockImplementation(
      defaultGet([PRACTITIONERS_TWO[0]], USERS_EMPTY),
    );
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    expect(screen.queryByTestId('user-assignment-section')).toBeNull();
  });

  it('3. SECRETAIRE + 2 médecins → section rendue avec multi-select', async () => {
    apiMock.get.mockImplementation(defaultGet(PRACTITIONERS_TWO, USERS_EMPTY));
    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    await waitFor(() =>
      expect(screen.getByTestId('user-assignment-section')).toBeInTheDocument(),
    );
    expect(screen.getByLabelText('Anas El Amrani')).toBeInTheDocument();
    expect(screen.getByLabelText('Sofia Bennani')).toBeInTheDocument();
    // Default : tous cochés.
    expect(
      (screen.getByLabelText('Anas El Amrani') as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Sofia Bennani') as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('4. submit sélection partielle → POST contient assignedPractitionerIds', async () => {
    apiMock.get.mockImplementation(defaultGet(PRACTITIONERS_TWO, USERS_EMPTY));
    apiMock.post.mockResolvedValue({ data: {} });

    render(withClient(<UtilisateursTab />));
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau' }));
    await waitFor(() =>
      expect(screen.getByTestId('user-assignment-section')).toBeInTheDocument(),
    );

    // Décoche p1 (Anas) — il reste p2 (Sofia).
    await userEvent.click(screen.getByLabelText('Anas El Amrani'));

    // Remplit le minimum requis.
    await userEvent.type(screen.getByLabelText('Email *'), 'sec@cabinet.ma');
    await userEvent.type(
      screen.getByLabelText('Mot de passe initial *'),
      'longpassword12',
    );
    await userEvent.type(screen.getByLabelText('Prénom *'), 'Lila');
    await userEvent.type(screen.getByLabelText('Nom *'), 'Test');

    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));

    await waitFor(() => expect(apiMock.post).toHaveBeenCalled());
    const [url, body] = apiMock.post.mock.calls[0]!;
    expect(url).toBe('/admin/users');
    expect(body).toMatchObject({
      email: 'sec@cabinet.ma',
      roles: ['SECRETAIRE'],
      assignedPractitionerIds: ['p2'],
    });
  });

  it('5. edit existant → pré-rempli depuis GET /admin/users/{id}', async () => {
    const adminUser = {
      id: 'u-sec',
      email: 'sec@cabinet.ma',
      firstName: 'Lila',
      lastName: 'Test',
      phone: '+212600',
      enabled: true,
      roles: ['SECRETAIRE'],
    };
    apiMock.get.mockImplementation((url: string) => {
      if (url === '/admin/users') return Promise.resolve({ data: [adminUser] });
      if (url === '/practitioners') return Promise.resolve({ data: PRACTITIONERS_TWO });
      if (url === '/admin/users/u-sec') {
        return Promise.resolve({
          data: {
            id: 'u-sec',
            email: 'sec@cabinet.ma',
            firstName: 'Lila',
            lastName: 'Test',
            roles: ['SECRETAIRE'],
            assignedPractitionerIds: ['p2'], // pré-existant : seulement Sofia
          },
        });
      }
      return Promise.resolve({ data: null });
    });

    render(withClient(<UtilisateursTab />));
    await screen.findByText('Lila Test');
    await userEvent.click(
      screen.getByRole('button', { name: 'Modifier Lila Test' }),
    );

    await waitFor(() =>
      expect(screen.getByTestId('user-assignment-section')).toBeInTheDocument(),
    );
    // p2 coché, p1 décoché.
    expect(
      (screen.getByLabelText('Sofia Bennani') as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Anas El Amrani') as HTMLInputElement).checked,
    ).toBe(false);
  });
});
