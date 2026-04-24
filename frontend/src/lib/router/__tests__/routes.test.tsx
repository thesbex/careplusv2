import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, Navigate } from 'react-router-dom';
import LoginPage from '@/features/login/LoginPage';
import OnboardingPage from '@/features/onboarding/OnboardingPage';
import { Placeholder } from '@/features/_placeholders/Placeholder';

/**
 * The production router uses createBrowserRouter (History API). We rebuild an
 * equivalent tree with createMemoryRouter for tests — same screens, same paths,
 * controllable initial entry.
 */
function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <Navigate to="/login" replace /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        path: '/agenda',
        element: (
          <Placeholder
            active="agenda"
            mobileTab="agenda"
            title="Agenda"
            sub="Semaine du 21 avril"
            sprintDay="J4"
          />
        ),
      },
      {
        path: '/patients',
        element: (
          <Placeholder active="patients" mobileTab="patients" title="Patients" sprintDay="J3" />
        ),
      },
      {
        path: '/salle',
        element: (
          <Placeholder active="salle" mobileTab="salle" title="Salle d'attente" sprintDay="J5" />
        ),
      },
      {
        path: '/facturation',
        element: (
          <Placeholder active="factu" mobileTab="factu" title="Facturation" sprintDay="J7" />
        ),
      },
      { path: '*', element: <Navigate to="/login" replace /> },
    ],
    { initialEntries: [path] },
  );
  return render(<RouterProvider router={router} />);
}

describe('router', () => {
  it('/ redirects to /login', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Bon retour, docteur.' })).toBeInTheDocument();
  });

  it('unknown route redirects to /login', () => {
    renderAt('/nope/nada');
    expect(screen.getByRole('heading', { name: 'Bon retour, docteur.' })).toBeInTheDocument();
  });

  it('/onboarding renders the wizard', () => {
    renderAt('/onboarding');
    expect(
      screen.getByRole('heading', { name: 'Quand recevez-vous vos patients ?' }),
    ).toBeInTheDocument();
  });

  it('/agenda renders placeholder inside the desktop shell', () => {
    renderAt('/agenda');
    // Desktop shell's nav is present
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    // Sub text appears in the topbar
    expect(screen.getByText('Semaine du 21 avril')).toBeInTheDocument();
    // "Écran prévu pour le jour J4" copy
    expect(screen.getByText(/Écran prévu pour le jour J4/)).toBeInTheDocument();
  });

  it('/salle shows the salle placeholder and it is the active sidebar item', () => {
    renderAt('/salle');
    const activeItem = screen.getByRole('button', { name: /Salle d'attente/ });
    expect(activeItem).toHaveAttribute('aria-current', 'page');
  });

  it('clicking a sidebar item navigates to that route', async () => {
    const user = userEvent.setup();
    renderAt('/agenda');
    await user.click(screen.getByRole('button', { name: /Facturation/ }));
    expect(await screen.findByText(/Écran prévu pour le jour J7/)).toBeInTheDocument();
  });

  it('submitting login navigates to /agenda', async () => {
    const user = userEvent.setup();
    renderAt('/login');
    await user.click(screen.getByRole('button', { name: /Se connecter/ }));
    expect(
      await screen.findByRole('navigation', { name: 'Navigation principale' }),
    ).toBeInTheDocument();
  });
});
