import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import LandingPage from '../LandingPage';

function renderLanding() {
  // jsdom polyfill in test-setup.ts returns matches:false for matchMedia,
  // so LandingPage renders the desktop variant by default.
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
  it('renders the brand wordmark, hero copy, and Se connecter pointing to /login', () => {
    renderLanding();
    // Wordmark is split: "care" + "plus" — assert both pieces.
    expect(screen.getAllByText('care').length).toBeGreaterThan(0);
    expect(screen.getAllByText('plus').length).toBeGreaterThan(0);
    // Hero headline (split across <h1> + <em>).
    expect(screen.getByText(/La gestion de votre cabinet/)).toBeInTheDocument();
    expect(screen.getByText(/enfin simplement\./)).toBeInTheDocument();

    // Every "Se connecter" link points at /login.
    const loginLinks = screen.getAllByRole('link', { name: /Se connecter/i });
    expect(loginLinks.length).toBeGreaterThanOrEqual(1);
    loginLinks.forEach((a) => expect(a).toHaveAttribute('href', '/login'));
  });

  it('lists the four flow items and the trust strip', () => {
    renderLanding();
    expect(screen.getByText('Agenda intelligent')).toBeInTheDocument();
    expect(screen.getAllByText("Salle d'attente").length).toBeGreaterThan(0);
    // "Consultation SOAP" appears in flow card AND in pricing feature list.
    expect(screen.getAllByText('Consultation SOAP').length).toBeGreaterThan(0);
    // "Facturation conforme" : flow card + pricing list — getAllByText.
    expect(screen.getAllByText('Facturation conforme').length).toBeGreaterThan(0);
    // Trust badges (loi 09-08 + Maroc) appear in hero pill, footer.
    expect(screen.getAllByText(/loi 09-08/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Maroc/i).length).toBeGreaterThan(0);
  });

  it('renders the three pricing tiers with the new design pricing', () => {
    renderLanding();
    expect(screen.getByText('Solo')).toBeInTheDocument();
    // "Cabinet" appears as the price tier name AND in microcopy elsewhere — getAllByText.
    expect(screen.getAllByText('Cabinet').length).toBeGreaterThan(0);
    expect(screen.getByText('Multi-cabinets')).toBeInTheDocument();
    expect(screen.getByText('290')).toBeInTheDocument();
    expect(screen.getByText('490')).toBeInTheDocument();
    expect(screen.getByText('990')).toBeInTheDocument();
  });
});
