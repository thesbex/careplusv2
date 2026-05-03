import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LandingPage from '../LandingPage';

function renderLanding() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <LandingPage /> },
      { path: '/login', element: <div data-testid="login-page">Login</div> },
    ],
    { initialEntries: ['/'] },
  );
  return render(<RouterProvider router={router} />);
}

describe('<LandingPage />', () => {
  it('renders the brand, hero copy, and primary CTA pointing to /login', () => {
    renderLanding();
    // Brand + tagline
    expect(screen.getAllByText('careplus').length).toBeGreaterThan(0);
    expect(screen.getByText(/La gestion de votre cabinet/)).toBeInTheDocument();
    expect(screen.getByText('simplement.')).toBeInTheDocument();

    // The two primary CTAs (topbar + hero + final) all point at /login.
    const loginLinks = screen.getAllByRole('link', { name: /Se connecter/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(2);
    loginLinks.forEach((a) => expect(a).toHaveAttribute('href', '/login'));
  });

  it('lists the four feature cards and the trust strip', () => {
    renderLanding();
    expect(screen.getByText('Agenda intelligent')).toBeInTheDocument();
    expect(screen.getByText('Dossier patient')).toBeInTheDocument();
    expect(screen.getByText('Ordonnances & bons')).toBeInTheDocument();
    expect(screen.getByText('Facturation conforme')).toBeInTheDocument();
    expect(screen.getByText(/Conforme loi 09-08/)).toBeInTheDocument();
    expect(screen.getByText(/Hébergement au Maroc/)).toBeInTheDocument();
  });
});
