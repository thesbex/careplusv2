import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvolutionChart } from '../components/EvolutionChart';

// Recharts' ResponsiveContainer relies on layout measurements that don't work
// in jsdom — mock it to a fixed-size <div> so the LineChart inside still
// renders deterministically.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="rc-responsive" style={{ width: 600, height: 160 }}>
        {children}
      </div>
    ),
  };
});

describe('<EvolutionChart />', () => {
  it('renders an empty state when no data points', () => {
    render(
      <EvolutionChart
        ariaLabel="Empty"
        series={[{ id: 's', label: 'X', color: '#000', points: [] }]}
      />,
    );
    expect(screen.getByText(/Aucune donnée enregistrée/)).toBeInTheDocument();
    // The empty state container still exposes the aria-label.
    expect(screen.getByRole('img', { name: 'Empty' })).toBeInTheDocument();
  });

  it('renders the chart container with aria-label when data exists', () => {
    render(
      <EvolutionChart
        ariaLabel="Tension"
        series={[
          {
            id: 'sys',
            label: 'Systolique',
            color: '#1e5aa8',
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
    // The chart container is exposed as role=img with the proper accessible name.
    expect(screen.getByRole('img', { name: 'Tension' })).toBeInTheDocument();
    // The mocked ResponsiveContainer is mounted (proves Recharts is wired in).
    expect(screen.getByTestId('rc-responsive')).toBeInTheDocument();
  });

  it('does not crash when given number-like strings (BigDecimal-as-string)', () => {
    expect(() =>
      render(
        <EvolutionChart
          ariaLabel="WithStrings"
          series={[
            {
              id: 't',
              label: 'T°',
              color: '#1e5aa8',
              points: [
                { x: '2026-04-20T10:00:00Z', y: '36.8' as unknown as number },
                { x: '2026-04-30T10:00:00Z', y: '37.2' as unknown as number },
              ],
            },
          ]}
        />,
      ),
    ).not.toThrow();
  });
});
