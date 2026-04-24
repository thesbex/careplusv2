import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Pill } from '../Pill';

describe('<Pill />', () => {
  it('renders plain pill', () => {
    render(<Pill>Label</Pill>);
    expect(screen.getByText('Label')).toHaveClass('pill');
  });

  it.each(['arrived', 'waiting', 'vitals', 'consult', 'done', 'allergy'] as const)(
    'applies the %s status class',
    (status) => {
      render(<Pill status={status}>x</Pill>);
      expect(screen.getByText('x')).toHaveClass(status);
    },
  );

  it('renders the dot when requested', () => {
    const { container } = render(<Pill dot>Active</Pill>);
    expect(container.querySelector('.dot')).toBeInTheDocument();
  });

  it('has no a11y violations', async () => {
    const { container } = render(
      <div>
        <Pill status="arrived">Arrivé</Pill>
        <Pill status="waiting">En attente</Pill>
        <Pill status="allergy">Pénicilline</Pill>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
