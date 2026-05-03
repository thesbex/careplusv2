/**
 * EvolutionChart — courbe d'évolution Recharts d'une constante dans le temps.
 *
 * Une courbe = une ou plusieurs séries `Series` partageant le même axe Y
 * (ex. tension artérielle = systolique + diastolique sur le même graphe).
 *
 * Délègue le rendu à Recharts (~85 KB gzippé) plutôt que de maintenir un
 * SVG fait-main : axes propres, tooltips natifs, responsive, accessibilité,
 * gestion des nulls — tout ça gratuitement et avec le polish attendu en
 * production. Les défauts visuels précédents (labels Y type "999999999994",
 * lignes qui fuyaient sous les cartes) disparaissent du même coup.
 */
import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export interface SeriesPoint {
  /** ISO timestamp ou Date — converti en `Date` côté composant. */
  x: string | Date;
  /**
   * Valeur numérique ; `null` saute le point. Les "number-like strings"
   * (Jackson sérialise parfois BigDecimal en string) sont tolérés.
   */
  y: number | string | null;
}

export interface Series {
  /** Identifiant interne (clé Recharts). */
  id: string;
  /** Libellé affiché dans la légende et le tooltip. */
  label: string;
  /** Couleur de la ligne — utiliser un token CSS résolu (ex. '#1e5aa8'). */
  color: string;
  points: SeriesPoint[];
}

interface EvolutionChartProps {
  /** Une ou plusieurs séries partageant le même axe Y (ex. TA sys + dia). */
  series: Series[];
  /** Unité affichée dans le tooltip (ex. "mmHg"). */
  unit?: string | undefined;
  /** Hauteur en pixels — défaut 160. */
  height?: number | undefined;
  /**
   * Plage normale [min, max] — bande ombrée en arrière-plan.
   * Les valeurs en dehors restent visibles.
   */
  normalRange?: [number, number] | undefined;
  /**
   * Bornes Y "préférées". Si une mesure est en dehors, le domaine s'élargit
   * automatiquement pour la conserver visible (cas hypothermie / désaturation
   * profonde).
   */
  yDomain?: [number, number] | undefined;
  /** Format custom des valeurs Y. Défaut : 1 décimale, .0 retiré. */
  formatY?: ((v: number) => string) | undefined;
  /** Aria label. */
  ariaLabel?: string | undefined;
}

/** Default Y formatter — 1 décimale puis on retire un `.0` final. */
function defaultFormatY(v: number): string {
  if (!Number.isFinite(v)) return '';
  const s = v.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

function coerceY(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Recharts veut un tableau de records `{x, sys, dia, ...}` (une ligne par
 * timestamp). On fusionne les séries individuelles en cette structure.
 */
interface MergedRow {
  ts: number;
  label: string;
  [seriesKey: string]: number | string | null;
}

function mergeSeries(series: Series[]): MergedRow[] {
  const byTs = new Map<number, MergedRow>();
  for (const s of series) {
    for (const p of s.points) {
      const date = typeof p.x === 'string' ? new Date(p.x) : p.x;
      const ts = date.getTime();
      if (!Number.isFinite(ts)) continue;
      const existing = byTs.get(ts);
      const row =
        existing ??
        ({
          ts,
          label: date.toLocaleDateString('fr-MA', {
            day: '2-digit',
            month: '2-digit',
          }),
        } as MergedRow);
      row[s.id] = coerceY(p.y);
      byTs.set(ts, row);
    }
  }
  return Array.from(byTs.values()).sort((a, b) => a.ts - b.ts);
}

export function EvolutionChart({
  series,
  unit = '',
  height = 160,
  normalRange,
  yDomain,
  formatY = defaultFormatY,
  ariaLabel,
}: EvolutionChartProps) {
  const data = useMemo(() => mergeSeries(series), [series]);

  // Calcul de min/max effectifs sur les données pour élargir un yDomain
  // préférentiel quand un point déborde (ex. T° 33°C avec yDomain [35,41]).
  const computedYDomain = useMemo<[number | 'auto', number | 'auto']>(() => {
    const ys = data.flatMap((row) =>
      series
        .map((s) => row[s.id])
        .filter((v): v is number => typeof v === 'number'),
    );
    if (ys.length === 0) return ['auto', 'auto'];
    const dataLow = Math.min(...ys);
    const dataHigh = Math.max(...ys);
    if (yDomain) {
      const low = Math.min(yDomain[0], dataLow);
      const high = Math.max(yDomain[1], dataHigh);
      const span = Math.max(high - low, 1);
      return [low - span * 0.05, high + span * 0.05];
    }
    const span = Math.max(dataHigh - dataLow, 1);
    return [dataLow - span * 0.1, dataHigh + span * 0.1];
  }, [data, series, yDomain]);

  if (data.length === 0) {
    return (
      <div
        role="img"
        aria-label={ariaLabel}
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink-3)',
          fontSize: 12,
          fontStyle: 'italic',
        }}
      >
        Aucune donnée enregistrée.
      </div>
    );
  }

  return (
    <div role="img" aria-label={ariaLabel} style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="2 3" vertical={false} />
          {normalRange && (
            <ReferenceArea
              y1={normalRange[0]}
              y2={normalRange[1]}
              fill="var(--primary)"
              fillOpacity={0.06}
              ifOverflow="extendDomain"
            />
          )}
          <XAxis
            dataKey="label"
            stroke="var(--ink-3)"
            tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            domain={computedYDomain}
            stroke="var(--ink-3)"
            tick={{ fontSize: 10, fill: 'var(--ink-3)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatY}
            width={36}
          />
          <Tooltip
            cursor={{ stroke: 'var(--border)', strokeDasharray: '2 3' }}
            contentStyle={{
              background: 'var(--ink)',
              border: 'none',
              borderRadius: 4,
              padding: '6px 10px',
              fontSize: 11,
              color: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
            labelStyle={{ color: '#fff', opacity: 0.7, fontSize: 10, marginBottom: 2 }}
            itemStyle={{ color: '#fff', padding: 0 }}
            formatter={(v, name) => {
              const n = typeof v === 'number' ? v : Number(v);
              if (!Number.isFinite(n)) return ['—', String(name)];
              const formatted = formatY(n);
              return [unit ? `${formatted} ${unit}` : formatted, String(name)];
            }}
          />
          {series.map((s) => (
            <Line
              key={s.id}
              type="monotone"
              dataKey={s.id}
              name={s.label}
              stroke={s.color}
              strokeWidth={1.8}
              dot={{ r: 2.5, fill: s.color, strokeWidth: 0 }}
              activeDot={{ r: 4, fill: s.color }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
