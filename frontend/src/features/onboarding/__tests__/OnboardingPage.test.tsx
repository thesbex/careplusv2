/**
 * The original onboarding screen rendered a single static "Horaires" step.
 * The page is now a 4-step wired wizard (Cabinet / Tarifs / Équipe / Récap)
 * that hits real settings endpoints. These tests cover the new shape.
 */
import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import OnboardingPage from '../OnboardingPage';

vi.mock('@/lib/api/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: null }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

function renderPage(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  return render(<OnboardingPage />, { wrapper });
}

describe('<OnboardingPage />', () => {
  it('renders a 4-step progress rail with step 1 (Cabinet) active', () => {
    renderPage();
    const nav = screen.getByRole('navigation', { name: 'Étapes de configuration' });
    const items = within(nav).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    ['Cabinet', 'Tarifs', 'Équipe', 'Prêt'].forEach((label) =>
      expect(within(nav).getByText(label)).toBeInTheDocument(),
    );
    const active = within(nav).getByText('Cabinet').closest('li');
    expect(active).toHaveAttribute('aria-current', 'step');
  });

  it('shows the cabinet identity form on the first step', () => {
    renderPage();
    expect(screen.getByText('Étape 1 sur 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Identité du cabinet' })).toBeInTheDocument();
  });

  it('exposes Précédent / Passer cette étape / Continuer in the footer', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /Précédent/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Passer cette étape' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Continuer/ })).toBeInTheDocument();
  });

});
