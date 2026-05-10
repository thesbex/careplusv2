import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BrandMark, BrandWordmark } from '../BrandMark';

describe('<BrandMark />', () => {
  it('renders the inline SVG glyph aria-hidden', () => {
    const { container } = render(<BrandMark />);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark).toHaveClass('cp-brand-mark');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark.querySelector('svg')).not.toBeNull();
  });

  it.each(['sm', 'md', 'lg'] as const)('applies the %s size', (size) => {
    const expected = { sm: 26, md: 28, lg: 34 }[size];
    const { container } = render(<BrandMark size={size} />);
    const mark = container.firstElementChild as HTMLElement;
    expect(mark.style.width).toBe(`${expected}px`);
    expect(mark.style.height).toBe(`${expected}px`);
  });

  it('uses gradient strokes by default and a solid white fill when inverted', () => {
    const { container: a } = render(<BrandMark />);
    const { container: b } = render(<BrandMark tone="inverted" />);
    // primary tone: <defs> with gradients; SVG strokes/fills reference url(#…)
    expect(a.querySelector('linearGradient')).not.toBeNull();
    expect(a.querySelector('path[stroke^="url(#"]')).not.toBeNull();
    // inverted tone: no <defs>, plain white fill
    expect(b.querySelector('linearGradient')).toBeNull();
    expect(b.querySelector('path[stroke="#fff"]')).not.toBeNull();
  });
});

describe('<BrandWordmark />', () => {
  it('splits "care" (ink) and "plus" (primary)', () => {
    const { container } = render(<BrandWordmark />);
    const spans = container.querySelectorAll('span');
    expect(spans).toHaveLength(2);
    expect(spans[0]?.textContent).toBe('care');
    expect(spans[0]?.style.color).toContain('--ink');
    expect(spans[1]?.textContent).toBe('plus');
    expect(spans[1]?.style.color).toContain('--primary');
  });

  it('renders both halves white when inverted', () => {
    const { container } = render(<BrandWordmark tone="inverted" />);
    const spans = container.querySelectorAll('span');
    expect(spans[0]?.style.color).toBe('rgb(255, 255, 255)');
    expect(spans[1]?.style.color).toBe('rgb(255, 255, 255)');
  });
});
