import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Screen } from '../Screen';

// Screen souscrit à useQueue() pour alimenter le badge live de la Salle
// d'attente. Tous les renders doivent donc s'exécuter dans un provider.
function withClient(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe('<Screen />', () => {
  it('composes Sidebar + Topbar + workspace', () => {
    const { container } = render(
      withClient(
        <Screen active="agenda" title="Semaine du 21 avril">
          <div data-testid="ws">workspace</div>
        </Screen>,
      ),
    );
    // Sidebar nav present
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeInTheDocument();
    // Topbar title present (unique — no sidebar item shares this string)
    expect(container.querySelector('.cp-topbar-title')).toHaveTextContent('Semaine du 21 avril');
    // Workspace content rendered
    expect(screen.getByTestId('ws')).toHaveTextContent('workspace');
  });

  it('renders the optional right panel when passed', () => {
    render(
      withClient(
        <Screen active="agenda" title="x" right={<div data-testid="rp">right</div>}>
          <div>content</div>
        </Screen>,
      ),
    );
    expect(screen.getByTestId('rp')).toBeInTheDocument();
  });

  it('omits the right panel when not passed', () => {
    const { container } = render(
      withClient(
        <Screen active="agenda" title="x">
          <div>content</div>
        </Screen>,
      ),
    );
    expect(container.querySelector('.cp-rightpanel')).toBeNull();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      withClient(
        <Screen active="salle" title="Salle d'attente" pageDate="Jeudi 24 avril">
          <div>content</div>
        </Screen>,
      ),
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it('does not render the salle badge when no patient is in the queue', () => {
    // Sans `counts` explicite, useSalleBadgeCount retourne `undefined` tant
    // que /api/queue n'a pas répondu — donc PAS de badge affiché. C'est le
    // remplacement du faux "3" hardcodé qui s'affichait avant 2026-05-01.
    render(
      withClient(
        <Screen active="agenda" title="x">
          <div>content</div>
        </Screen>,
      ),
    );
    expect(screen.queryByLabelText(/en attente/)).not.toBeInTheDocument();
  });
});
