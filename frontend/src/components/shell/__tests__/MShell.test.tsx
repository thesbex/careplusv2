import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { MTopbar, MIconBtn } from '../MTopbar';
import { MTabs } from '../MTabs';
import { MScreen } from '../MScreen';

describe('<MTopbar />', () => {
  it('renders brand when brand prop is true', () => {
    const { container } = render(<MTopbar brand />);
    expect(container.querySelector('.mt-brand-name')).toHaveTextContent('careplus');
  });

  it('renders title + sub when provided', () => {
    render(<MTopbar title="Agenda" sub="Jeudi 24 avril" />);
    expect(screen.getByText('Agenda')).toHaveClass('mt-title');
    expect(screen.getByText('Jeudi 24 avril')).toHaveClass('mt-sub');
  });

  it('MIconBtn fires onClick with proper aria-label', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<MIconBtn icon="Bell" onClick={onClick} label="Notifications" />);
    await user.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe('<MTabs />', () => {
  it('renders 5 tabs with the expected labels', () => {
    render(<MTabs />);
    ['Agenda', 'Salle', 'Patients', 'Factures', 'Plus'].forEach((label) =>
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeInTheDocument(),
    );
  });

  it('marks the active tab with aria-current="page" and the .on class', () => {
    render(<MTabs active="salle" />);
    const salle = screen.getByRole('button', { name: /Salle/ });
    expect(salle).toHaveAttribute('aria-current', 'page');
    expect(salle).toHaveClass('on');
  });

  it('shows badge when > 0', () => {
    render(<MTabs badges={{ salle: 3 }} />);
    expect(screen.getByLabelText('3 notifications')).toHaveTextContent('3');
  });

  it('calls onTabChange with the tab id on click', async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<MTabs onTabChange={onTabChange} />);
    await user.click(screen.getByRole('button', { name: /Factures/ }));
    expect(onTabChange).toHaveBeenCalledWith('factu');
  });
});

describe('<MScreen />', () => {
  it('renders topbar + body + tabs by default', () => {
    const { container } = render(
      <MScreen topbar={<MTopbar brand />}>
        <div data-testid="content">Hello</div>
      </MScreen>,
    );
    expect(container.querySelector('.mt-brand-name')).toHaveTextContent('careplus');
    expect(screen.getByTestId('content')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigation mobile' })).toBeInTheDocument();
  });

  it('omits the bottom tabs when noTabs is passed', () => {
    render(
      <MScreen noTabs topbar={<MTopbar title="x" />}>
        <div>content</div>
      </MScreen>,
    );
    expect(screen.queryByRole('navigation', { name: 'Navigation mobile' })).not.toBeInTheDocument();
  });

  it('renders the FAB when provided', () => {
    render(
      <MScreen topbar={<MTopbar title="x" />} fab={<button data-testid="fab">+</button>}>
        <div>content</div>
      </MScreen>,
    );
    expect(screen.getByTestId('fab')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <MScreen topbar={<MTopbar brand title="careplus" />}>
        <div className="mb-pad">content</div>
      </MScreen>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
