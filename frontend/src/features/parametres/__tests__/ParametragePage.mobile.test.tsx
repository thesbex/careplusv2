import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import ParametrageMobilePage from '../ParametragePage.mobile';
import { useAuthStore } from '@/lib/auth/authStore';

function setUser(roles: string[]) {
  useAuthStore.setState({
    accessToken: 'test',
    user: {
      id: 'u1',
      email: 'k.elamrani@cabinet.ma',
      firstName: 'Karim',
      lastName: 'El Amrani',
      roles,
      permissions: [],
    },
  });
}

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const router = createMemoryRouter(
    [
      { path: '/parametres', element: <ParametrageMobilePage /> },
      { path: '/catalogue', element: <div>Catalogue</div> },
    ],
    { initialEntries: ['/parametres'] },
  );
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('<ParametrageMobilePage /> — NRG', () => {
  beforeEach(() => useAuthStore.setState({ accessToken: null, user: null }));

  it('renders the profile header (m-phead) with user initials and role label', () => {
    setUser(['MEDECIN']);
    const { container } = renderPage();
    expect(container.querySelector('.m-phead')).toBeInTheDocument();
    expect(container.querySelector('.m-phead-name')).toHaveTextContent('Karim El Amrani');
    expect(container.querySelector('.m-phead-meta')).toHaveTextContent('Médecin');
  });

  it('shows the Cabinet section + Catalogues + Compte for ADMIN/MEDECIN', () => {
    setUser(['ADMIN']);
    renderPage();
    expect(screen.getByText('Cabinet')).toBeInTheDocument();
    expect(screen.getByText('Paramétrage du cabinet')).toBeInTheDocument();
    expect(screen.getByText('Catalogues')).toBeInTheDocument();
    // Three catalogue rows now: medications, lab, imaging.
    expect(screen.getByText('Médicaments')).toBeInTheDocument();
    expect(screen.getByText('Analyses biologiques')).toBeInTheDocument();
    expect(screen.getByText('Radio / Imagerie')).toBeInTheDocument();
    expect(screen.getByText('Compte')).toBeInTheDocument();
  });

  it('hides the Cabinet section for non-admin roles', () => {
    setUser(['SECRETAIRE']);
    renderPage();
    expect(screen.queryByText('Cabinet')).not.toBeInTheDocument();
    expect(
      screen.getByText(/réservés à l’administrateur et au médecin/i),
    ).toBeInTheDocument();
  });

  it('renders the logout row with danger styling', () => {
    setUser(['SECRETAIRE']);
    renderPage();
    expect(screen.getByText('Déconnexion')).toBeInTheDocument();
  });

  it('renders an icon badge before each menu row label (m-row leading icon)', () => {
    setUser(['MEDECIN']);
    const { container } = renderPage();
    // Each m-row inside .m-card should have an icon badge child (svg).
    const rows = container.querySelectorAll('.m-card .m-row');
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.querySelector('svg')).toBeInTheDocument();
    });
  });
});
