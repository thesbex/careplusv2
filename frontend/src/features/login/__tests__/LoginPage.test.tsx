import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { useAuthStore } from '@/lib/auth/authStore';

// Mock the axios client so we can control the server response.
const mockPost = vi.fn();
vi.mock('@/lib/api/client', () => ({
  api: {
    post: (...args: unknown[]) => mockPost(...args),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

function renderLogin(initialPath = '/login') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/agenda', element: <div data-testid="agenda-page">Agenda</div> },
    ],
    { initialEntries: [initialPath] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  useAuthStore.getState().clear();
  mockPost.mockReset();
});

describe('<LoginPage />', () => {
  it('renders the bilingual hero + form with the right copy', () => {
    renderLogin();
    expect(screen.getByText('careplus')).toBeInTheDocument();
    expect(screen.getByText(/La gestion de votre cabinet/)).toBeInTheDocument();
    expect(screen.getByText('simplement.')).toBeInTheDocument();
    expect(screen.getByText('184')).toBeInTheDocument();
    expect(screen.getByText('62k')).toBeInTheDocument();
    expect(screen.getByText('99,98%')).toBeInTheDocument();
    expect(screen.getByText(/Conforme loi 09-08/)).toBeInTheDocument();
    expect(screen.getByText('Connexion professionnelle')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bon retour, docteur.' })).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse email')).toHaveValue('');
    expect(screen.getByLabelText('Adresse email')).toHaveAttribute('placeholder', 'vous@cabinet.ma');
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
  });

  it('toggles password visibility when the eye button is clicked', async () => {
    const user = userEvent.setup();
    renderLogin();
    const password = screen.getByLabelText('Mot de passe') as HTMLInputElement;
    expect(password.type).toBe('password');
    await user.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }));
    expect(password.type).toBe('text');
  });

  it('rejects an empty password client-side via zod', async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));
    expect(await screen.findByText('Au moins 8 caractères')).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('submits to /auth/login, stores session, and navigates to /agenda', async () => {
    const user = userEvent.setup();
    mockPost.mockResolvedValueOnce({
      data: {
        accessToken: 'eyJ-fake-token',
        expiresInSeconds: 900,
        user: {
          id: 'u1',
          email: 'f.benjelloun@cab-elamrani.ma',
          firstName: 'Fatima',
          lastName: 'Benjelloun',
          roles: ['SECRETAIRE'],
        },
      },
    });
    renderLogin();

    await user.type(screen.getByLabelText('Adresse email'), 'f.benjelloun@cab-elamrani.ma');
    await user.type(screen.getByLabelText('Mot de passe'), 'ChangeMe123!');
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    expect(mockPost).toHaveBeenCalledWith('/auth/login', {
      email: 'f.benjelloun@cab-elamrani.ma',
      password: 'ChangeMe123!',
    });

    expect(await screen.findByTestId('agenda-page')).toBeInTheDocument();
    expect(useAuthStore.getState().accessToken).toBe('eyJ-fake-token');
    expect(useAuthStore.getState().user?.firstName).toBe('Fatima');
    expect(useAuthStore.getState().hasRole('SECRETAIRE')).toBe(true);
  });

  it('renders an inline error on 401 without clearing fields', async () => {
    const user = userEvent.setup();
    mockPost.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 401, data: { title: 'Identifiants incorrects', status: 401 } },
    });
    renderLogin();
    await user.type(screen.getByLabelText('Adresse email'), 'f.benjelloun@cab-elamrani.ma');
    await user.type(screen.getByLabelText('Mot de passe'), 'wrongpwd123');
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));
    expect(await screen.findByText('Identifiants incorrects')).toBeInTheDocument();
    expect((screen.getByLabelText('Mot de passe') as HTMLInputElement).value).toBe('wrongpwd123');
    expect(useAuthStore.getState().accessToken).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLogin();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
