import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import OnboardingPage from '../OnboardingPage';

describe('<OnboardingPage />', () => {
  it('renders the 7-step progress rail with step 3 active and steps 1–2 done', () => {
    render(<OnboardingPage />);
    const nav = screen.getByRole('navigation', { name: 'Étapes de configuration' });
    const items = within(nav).getAllByRole('listitem');
    const stepItems = items.filter((li) => !li.classList.contains('ob-step-connector'));
    expect(stepItems).toHaveLength(7);
    const labels = ['Cabinet', 'Médecin', 'Horaires', 'Équipe', 'Tarifs', 'Documents', 'Prêt'];
    labels.forEach((label) => expect(within(nav).getByText(label)).toBeInTheDocument());

    const active = within(nav).getByText('Horaires').closest('li');
    expect(active).toHaveClass('active');
    expect(active).toHaveAttribute('aria-current', 'step');
  });

  it('renders the question copy and the 3 quick templates with one preselected', () => {
    render(<OnboardingPage />);
    expect(screen.getByText('Étape 3 sur 7')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Quand recevez-vous vos patients ?' }),
    ).toBeInTheDocument();
    const classic = screen.getByRole('button', { name: /Cabinet classique/ });
    expect(classic).toHaveClass('selected');
    expect(screen.getByRole('button', { name: /Journée continue/ })).not.toHaveClass('selected');
  });

  it('renders all 7 days with their default open/closed state', () => {
    render(<OnboardingPage />);
    expect(screen.getByText('Lundi')).toBeInTheDocument();
    expect(screen.getByText('Samedi')).toBeInTheDocument();
    expect(screen.getByText('Dimanche')).toBeInTheDocument();
    // Saturday is half-day
    expect(screen.getByText('Demi-journée')).toBeInTheDocument();
    // Sunday is closed
    expect(
      screen.getByRole('checkbox', { name: 'Dimanche — fermé' }),
    ).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Lundi — ouvert' })).toBeChecked();
  });

  it('has Moroccan-holiday option checked by default', () => {
    render(<OnboardingPage />);
    expect(
      screen.getByRole('checkbox', { name: /Respecter les jours fériés marocains/ }),
    ).toBeChecked();
  });

  it('footer exposes Precedent / Passer / Continuer actions', async () => {
    render(<OnboardingPage />);
    expect(screen.getByRole('button', { name: /Précédent/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer cette étape' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuer — Équipe/ })).toBeInTheDocument();
  });

  it('toggles the Sunday checkbox', async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);
    const sunday = screen.getByRole('checkbox', { name: 'Dimanche — fermé' });
    await user.click(sunday);
    expect(sunday).toBeChecked();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<OnboardingPage />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
