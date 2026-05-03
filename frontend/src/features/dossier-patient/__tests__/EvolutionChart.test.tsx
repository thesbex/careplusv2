import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvolutionChart } from '../components/EvolutionChart';

describe('<EvolutionChart />', () => {
  it('renders an empty state when no data points', () => {
    render(<EvolutionChart series={[{ id: 's', label: 'X', color: '#000', points: [] }]} />);
    expect(screen.getByText(/Aucune donnée enregistrée/)).toBeInTheDocument();
  });

  it('draws a path for the series and renders a hidden accessible table', () => {
    render(
      <EvolutionChart
        ariaLabel="Tension"
        series={[
          {
            id: 'sys',
            label: 'Systolique',
            color: '#000',
            points: [
              { x: '2026-04-20T10:00:00Z', y: 120 },
              { x: '2026-04-25T10:00:00Z', y: 135 },
              { x: '2026-04-30T10:00:00Z', y: 128 },
            ],
          },
        ]}
        unit="mmHg"
      />,
    );
    // SVG with role=img is rendered.
    const svg = screen.getByRole('img', { name: 'Tension' });
    expect(svg.tagName.toLowerCase()).toBe('svg');
    // path data exists for the series
    const path = svg.querySelector('path');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')).toMatch(/^M/);
    // accessible table fallback shows the values
    expect(screen.getByRole('table', { name: 'Tension' })).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('135')).toBeInTheDocument();
  });

  it('skips null y values without breaking the line', () => {
    render(
      <EvolutionChart
        ariaLabel="Series with gap"
        series={[
          {
            id: 'a',
            label: 'A',
            color: '#000',
            points: [
              { x: '2026-04-01T10:00:00Z', y: 10 },
              { x: '2026-04-02T10:00:00Z', y: null },
              { x: '2026-04-03T10:00:00Z', y: 20 },
            ],
          },
        ]}
      />,
    );
    const svg = screen.getByRole('img', { name: 'Series with gap' });
    const d = svg.querySelector('path')?.getAttribute('d') ?? '';
    // Two `M` commands → the line is split around the missing point.
    const moveCount = (d.match(/M/g) ?? []).length;
    expect(moveCount).toBeGreaterThanOrEqual(2);
  });
});
