import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Screen } from '../Screen';

describe('<Screen />', () => {
  it('composes Sidebar + Topbar + workspace', () => {
    const { container } = render(
      <Screen active="agenda" title="Semaine du 21 avril">
        <div data-testid="ws">workspace</div>
      </Screen>,
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
      <Screen active="agenda" title="x" right={<div data-testid="rp">right</div>}>
        <div>content</div>
      </Screen>,
    );
    expect(screen.getByTestId('rp')).toBeInTheDocument();
  });

  it('omits the right panel when not passed', () => {
    const { container } = render(
      <Screen active="agenda" title="x">
        <div>content</div>
      </Screen>,
    );
    expect(container.querySelector('.cp-rightpanel')).toBeNull();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <Screen active="salle" title="Salle d'attente" pageDate="Jeudi 24 avril">
        <div>content</div>
      </Screen>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
