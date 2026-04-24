import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { Button } from '../Button';

describe('<Button />', () => {
  it('renders as a button with type="button" by default', () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole('button', { name: 'Click me' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn).toHaveClass('btn');
  });

  it.each([
    ['primary', 'primary'],
    ['ghost', 'ghost'],
    ['danger', 'danger'],
  ] as const)('applies the %s variant class', (variant, expected) => {
    render(<Button variant={variant}>x</Button>);
    expect(screen.getByRole('button')).toHaveClass(expected);
  });

  it.each([
    ['sm', 'sm'],
    ['lg', 'lg'],
  ] as const)('applies the %s size class', (size, expected) => {
    render(<Button size={size}>x</Button>);
    expect(screen.getByRole('button')).toHaveClass(expected);
  });

  it('applies the icon class when iconOnly is set', () => {
    render(<Button iconOnly aria-label="Close">×</Button>);
    expect(screen.getByRole('button')).toHaveClass('icon');
  });

  it('fires onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Go</Button>);
    await user.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('respects disabled', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('has no a11y violations across variants', async () => {
    const { container } = render(
      <div>
        <Button>default</Button>
        <Button variant="primary">primary</Button>
        <Button variant="ghost">ghost</Button>
        <Button variant="danger">danger</Button>
        <Button iconOnly aria-label="close">
          ×
        </Button>
      </div>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
