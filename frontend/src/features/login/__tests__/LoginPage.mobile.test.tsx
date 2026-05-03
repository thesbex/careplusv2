import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LoginMobilePage from '../LoginPage.mobile';

vi.mock('@/lib/auth/useAuth', () => ({
  useLogin: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginMobilePage /> },
      { path: '/agenda', element: <div>Agenda</div> },
    ],
    { initialEntries: ['/login'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<LoginMobilePage /> — NRG', () => {
  it('renders with the cp-mobile / cp-app root classes (mobile resets apply)', () => {
    const { container } = renderPage();
    const root = container.querySelector('.cp-mobile.cp-app');
    expect(root).toBeInTheDocument();
  });

  it('renders the gradient hero with brand mark and tagline', () => {
    renderPage();
    expect(screen.getByText('careplus')).toBeInTheDocument();
    expect(screen.getByText(/Bon retour/i)).toBeInTheDocument();
    expect(screen.getByText(/docteur\./i)).toBeInTheDocument();
    expect(screen.getByText('Connectez-vous à votre cabinet')).toBeInTheDocument();
  });

  it('renders email + password inputs and the connect button', () => {
    renderPage();
    expect(screen.getByLabelText('Adresse e-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Mot de passe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument();
  });

  it('uses .m-btn.primary for the submit button (mobile token system)', () => {
    renderPage();
    const submit = screen.getByRole('button', { name: /Se connecter/i });
    expect(submit.classList.contains('m-btn')).toBe(true);
    expect(submit.classList.contains('primary')).toBe(true);
  });
});
