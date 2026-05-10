import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Sidebar } from '../Sidebar';
import { useAuthStore } from '@/lib/auth/authStore';

// Sidebar embarque un UserChip qui utilise useNavigate (Mon profil) +
// useClinicSettings + 3 hooks badge. Tous les renders ont besoin du
// Router et du QueryClient.
function withProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  // Most cases assume a logged-in user with all rights so every nav item
  // (incl. Paramètres) is visible. Role-based hiding is exercised explicitly
  // in the dedicated test below.
  useAuthStore.setState({
    accessToken: 'test-token',
    user: {
      id: 'u-test',
      email: 'med@careplus.ma',
      firstName: 'Test',
      lastName: 'Med',
      roles: ['MEDECIN', 'ADMIN'],
    },
  });
});

describe('<Sidebar />', () => {
  it('renders all 6 nav items across the two sections', () => {
    render(withProviders(<Sidebar />));
    expect(screen.getByText('Flux patient')).toBeInTheDocument();
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    [
      'Agenda',
      'Patients',
      "Salle d'attente",
      'Consultations',
      'Facturation',
      'Paramètres',
    ].forEach((label) => expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument());
  });

  it('marks the active item with aria-current="page"', () => {
    render(withProviders(<Sidebar active="salle" />));
    const active = screen.getByRole('button', { name: /Salle d'attente/ });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('active');
    // Agenda (default active) should no longer be marked active
    expect(screen.getByRole('button', { name: /Agenda/ })).not.toHaveClass('active');
  });

  it('renders the salle badge only when counts.salle > 0', () => {
    const { rerender } = render(withProviders(<Sidebar counts={{ salle: 3 }} />));
    expect(screen.getByLabelText('3 en attente')).toHaveTextContent('3');
    rerender(withProviders(<Sidebar counts={{ salle: 0 }} />));
    expect(screen.queryByLabelText(/en attente/)).not.toBeInTheDocument();
  });

  it('calls onNavigate with the item id on click', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(withProviders(<Sidebar onNavigate={onNavigate} />));
    await user.click(screen.getByRole('button', { name: /Facturation/ }));
    expect(onNavigate).toHaveBeenCalledWith('factu');
  });

  it('renders the cabinet + user identity', () => {
    render(
      withProviders(
        <Sidebar
          cabinet={{ name: 'careplus', city: 'Cab. Benjelloun · Rabat' }}
          user={{ name: 'Dr. K. El Amrani', role: 'Médecin', initials: 'KE' }}
        />,
      ),
    );
    expect(screen.getByText('Cab. Benjelloun · Rabat')).toBeInTheDocument();
    expect(screen.getByText('Dr. K. El Amrani')).toBeInTheDocument();
    expect(screen.getByText('KE')).toBeInTheDocument();
  });

  it('hides the Paramètres item for SECRETAIRE / ASSISTANT roles', () => {
    useAuthStore.setState({
      accessToken: 'test-token',
      user: {
        id: 'u-sec',
        email: 'sec@careplus.ma',
        firstName: 'Sec',
        lastName: 'User',
        roles: ['SECRETAIRE'],
      },
    });
    render(withProviders(<Sidebar />));
    expect(screen.queryByRole('button', { name: /Paramètres/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Agenda/ })).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(withProviders(<Sidebar />));
    expect(await axe(container)).toHaveNoViolations();
  });
});
