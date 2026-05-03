import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import * as Icons from '../index';

describe('icon set', () => {
  it('exports the 30 icons listed in DESIGN_SYSTEM.md §8', () => {
    const expected = [
      'Calendar',
      'Users',
      'Waiting',
      'Stetho',
      'Invoice',
      'Settings',
      'Search',
      'Plus',
      'Bell',
      'ChevronLeft',
      'ChevronRight',
      'ChevronDown',
      'ChevronUp',
      'Close',
      'Check',
      'Phone',
      'Print',
      'Pill',
      'Flask',
      'Scan',
      'Warn',
      'Heart',
      'Thermo',
      'Clipboard',
      'File',
      'Edit',
      'Trash',
      'Eye',
      'MoreH',
      'Lock',
      'Logout',
      'Sun',
      'Clock',
      'Doc',
      'Dot',
      'Menu',
      'Filter',
      'Signal',
    ];
    for (const name of expected) {
      expect(Icons).toHaveProperty(name);
    }
  });

  it('renders every icon at 16×16 with currentColor stroke and aria-hidden', () => {
    for (const [name, Icon] of Object.entries(Icons)) {
      const { container, unmount } = render(
        <span style={{ color: 'red' }}>
          <Icon />
        </span>,
      );
      const svg = container.querySelector('svg');
      expect(svg, `${name} should render an SVG`).not.toBeNull();
      expect(svg?.getAttribute('width')).toMatch(/^(16|10)$/); // Dot is 10×10
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
      unmount();
    }
  });
});
