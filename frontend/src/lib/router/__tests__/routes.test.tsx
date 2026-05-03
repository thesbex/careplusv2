import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, Navigate } from 'react-router-dom';
import LoginPage from '@/features/login/LoginPage';
import OnboardingPage from '@/features/onboarding/OnboardingPage';
import { Placeholder } from '@/features/_placeholders/Placeholder';
import { RequireAuth, GuestOnly } from '@/lib/auth/RequireAuth';
import { useAuthStore } from '@/lib/auth/authStore';

vi.mock('@/lib/api/client', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

function setAuthed() {
  useAuthStore.getState().setSession('t-123', {
    id: 'u1',
    email: 'x@y',
    firstName: 'X',
    lastName: 'Y',
    roles: ['SECRETAIRE'],
  });
}

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/', element: <Navigate to="/login" replace /> },
      {
        path: '/login',
        element: (
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        ),
      },
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        path: '/agenda',
        element: (
          <RequireAuth>
            <Placeholder active="agenda" mobileTab="agenda" title="Agenda" sprintDay="J4" />
          </RequireAuth>
        ),
      },
      {
        path: '/salle',
        element: (
          <RequireAuth>
            <Placeholder active="salle" mobileTab="salle" title="Salle d'attente" sprintDay="J5" />
          </RequireAuth>
        ),
      },
      {
        path: '/facturation',
        element: (
          <RequireAuth>
            <Placeholder active="factu" mobileTab="factu" title="Facturation" sprintDay="J7" />
          </RequireAuth>
        ),
      },
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
    { initialEntries: [path] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('router', () => {
  beforeEach(() => {
    useAuthStore.getState().clear();
  });

  it('/ redirects to /login when unauthenticated', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Bon retour, docteur.' })).toBeInTheDocument();
  });

  it('unknown route redirects to /login', () => {
    renderAt('/nope/nada');
    expect(screen.getByRole('heading', { name: 'Bon retour, docteur.' })).toBeInTheDocument();
  });

  it('/agenda while unauthenticated redirects to /login', () => {
    renderAt('/agenda');
    expect(screen.getByRole('heading', { name: 'Bon retour, docteur.' })).toBeInTheDocument();
  });

  it('/login while authenticated redirects to /agenda', () => {
    setAuthed();
    renderAt('/login');
    expect(screen.getByText(/Écran prévu pour le jour J4/)).toBeInTheDocument();
  });

  it('/onboarding renders the wizard (public)', () => {
    renderAt('/onboarding');
    expect(
      screen.getByRole('heading', { name: 'Quand recevez-vous vos patients ?' }),
    ).toBeInTheDocument();
  });

  it('/salle while authenticated renders placeholder and marks salle active', () => {
    setAuthed();
    renderAt('/salle');
    const activeItem = screen.getByRole('button', { name: /Salle d'attente/ });
    expect(activeItem).toHaveAttribute('aria-current', 'page');
  });

  it('authenticated user clicking a sidebar item navigates', async () => {
    setAuthed();
    const user = userEvent.setup();
    renderAt('/agenda');
    await user.click(screen.getByRole('button', { name: /Facturation/ }));
    expect(await screen.findByText(/Écran prévu pour le jour J7/)).toBeInTheDocument();
  });
});
