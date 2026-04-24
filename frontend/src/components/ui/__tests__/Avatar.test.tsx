import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Avatar } from '../Avatar';

describe('<Avatar />', () => {
  it('uppercases and trims to 2 chars', () => {
    render(<Avatar initials="fbenjelloun" />);
    expect(screen.getByText('FB')).toBeInTheDocument();
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size class', (size) => {
    const { container } = render(<Avatar initials="XY" size={size} />);
    const el = container.firstElementChild;
    expect(el).toHaveClass('cp-avatar');
    if (size !== 'md') expect(el).toHaveClass(size);
  });
});
