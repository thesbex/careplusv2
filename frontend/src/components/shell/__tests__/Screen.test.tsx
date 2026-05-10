import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Screen } from '../Screen';

// Le sidebar et la spotlight ⌘K vivent maintenant dans <AppLayout> ; <Screen>
// ne rend plus que le Topbar + workspace + right panel. On garde MemoryRouter
// car le Topbar utilise useSpotlight() — sans provider c'est un no-op, donc
// inoffensif, mais on reste dans un Router pour rester réaliste.
function withProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('<Screen />', () => {
  it('renders the topbar title and the workspace content', () => {
    const { container } = render(
      withProviders(
        <Screen active="agenda" title="Semaine du 21 avril">
          <div data-testid="ws">workspace</div>
        </Screen>,
      ),
    );
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent('Semaine du 21 avril');
    expect(screen.getByTestId('ws')).toHaveTextContent('workspace');
  });

  it('renders the optional right panel when passed', () => {
    render(
      withProviders(
        <Screen active="agenda" title="x" right={<div data-testid="rp">right</div>}>
          <div>content</div>
        </Screen>,
      ),
    );
    expect(screen.getByTestId('rp')).toBeInTheDocument();
  });

  it('omits the right panel when not passed', () => {
    const { container } = render(
      withProviders(
        <Screen active="agenda" title="x">
          <div>content</div>
        </Screen>,
      ),
    );
    expect(container.querySelector('.cp-rightpanel')).toBeNull();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      withProviders(
        <Screen active="salle" title="Salle d'attente" pageDate="Jeudi 24 avril">
          <div>content</div>
        </Screen>,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
