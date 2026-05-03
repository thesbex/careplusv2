import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrandMark } from '../BrandMark';

describe('<BrandMark />', () => {
  it('renders the letter c aria-hidden', () => {
    const { container } = render(<BrandMark />);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark).toHaveClass('cp-brand-mark');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark).toHaveTextContent('c');
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size', (size) => {
    const expected = { sm: 26, md: 28, lg: 34 }[size];
    const { container } = render(<BrandMark size={size} />);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.style.width).toBe(`${expected}px`);
    expect(mark.style.height).toBe(`${expected}px`);
  });

  it('uses white-on-primary by default and primary-on-white when inverted', () => {
    const { container: a } = render(<BrandMark />);
    const { container: b } = render(<BrandMark tone="inverted" />);
    expect((a.firstElementChild as HTMLElement).style.background).toMatch(/primary/);
    expect((b.firstElementChild as HTMLElement).style.background).toBe('rgb(255, 255, 255)');
  });
});
