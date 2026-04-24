import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Sidebar } from '../Sidebar';

describe('<Sidebar />', () => {
  it('renders all 6 nav items across the two sections', () => {
    render(<Sidebar />);
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
    render(<Sidebar active="salle" />);
    const active = screen.getByRole('button', { name: /Salle d'attente/ });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('active');
    // Agenda (default active) should no longer be marked active
    expect(screen.getByRole('button', { name: /Agenda/ })).not.toHaveClass('active');
  });

  it('renders the salle badge only when counts.salle > 0', () => {
    const { rerender } = render(<Sidebar counts={{ salle: 3 }} />);
    expect(screen.getByLabelText('3 en attente')).toHaveTextContent('3');
    rerender(<Sidebar counts={{ salle: 0 }} />);
    expect(screen.queryByLabelText(/en attente/)).not.toBeInTheDocument();
  });

  it('calls onNavigate with the item id on click', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<Sidebar onNavigate={onNavigate} />);
    await user.click(screen.getByRole('button', { name: /Facturation/ }));
    expect(onNavigate).toHaveBeenCalledWith('factu');
  });

  it('renders the cabinet + user identity', () => {
    render(
      <Sidebar
        cabinet={{ name: 'careplus', city: 'Cab. Benjelloun · Rabat' }}
        user={{ name: 'Dr. K. El Amrani', role: 'Médecin', initials: 'KE' }}
      />,
    );
    expect(screen.getByText('Cab. Benjelloun · Rabat')).toBeInTheDocument();
    expect(screen.getByText('Dr. K. El Amrani')).toBeInTheDocument();
    expect(screen.getByText('KE')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<Sidebar />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
