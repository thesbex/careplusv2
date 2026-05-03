import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Topbar } from '../Topbar';

describe('<Topbar />', () => {
  it('renders title and optional sub separated by a divider', () => {
    render(<Topbar title="Agenda" sub="Semaine du 21 avril" />);
    expect(screen.getByText('Agenda')).toBeInTheDocument();
    expect(screen.getByText('Semaine du 21 avril')).toBeInTheDocument();
  });

  it('renders the search button when showSearch (default)', () => {
    render(<Topbar title="x" />);
    const search = screen.getByRole('button', { name: 'Rechercher un patient' });
    expect(search).toHaveTextContent(/Rechercher un patient par nom, téléphone, CIN/);
    expect(screen.getByText('⌘ K')).toBeInTheDocument();
  });

  it('hides search when showSearch is false', () => {
    render(<Topbar title="x" showSearch={false} />);
    expect(screen.queryByRole('button', { name: 'Rechercher un patient' })).not.toBeInTheDocument();
  });

  it('renders pageDate with tabular-nums', () => {
    render(<Topbar title="x" pageDate="Jeudi 24 avril 2026" />);
    const el = screen.getByText('Jeudi 24 avril 2026');
    expect(el).toHaveClass('tnum');
  });

  it('fires onSearchOpen and onNotifications', async () => {
    const onSearchOpen = vi.fn();
    const onNotifications = vi.fn();
    const user = userEvent.setup();
    render(<Topbar title="x" onSearchOpen={onSearchOpen} onNotifications={onNotifications} />);
    await user.click(screen.getByRole('button', { name: 'Rechercher un patient' }));
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(onSearchOpen).toHaveBeenCalledOnce();
    expect(onNotifications).toHaveBeenCalledOnce();
  });

  it('has no a11y violations', async () => {
    const { container } = render(<Topbar title="Agenda" sub="Semaine" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
