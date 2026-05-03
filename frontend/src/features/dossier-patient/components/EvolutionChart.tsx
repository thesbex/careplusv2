/**
 * EvolutionChart — courbe d'évolution SVG d'une constante dans le temps.
 *
 * Implémentation maison plutôt qu'une lib comme Recharts/Chart.js pour :
 *   - matcher exactement les tokens du design system (couleurs, polices) sans
 *     surcharge de thème,
 *   - éviter ~85 KB gzippés ajoutés au bundle pour un besoin simple,
 *   - rester accessible (table HTML cachée derrière le SVG comme fallback).
 *
 * Une courbe = une ou plusieurs séries `Series` partageant le même axe Y.
 * Exemple : tension artérielle = systolique + diastolique sur le même graphe.
 */
import { useMemo, useState } from 'react';

export interface SeriesPoint {
  /** ISO timestamp ou Date — converti en `Date` côté composant. */
  x: string | Date;
  /**
   * Valeur numérique ; `null` saute le point (ne casse pas la ligne). Les
   * "number-like strings" (Jackson sérialise parfois BigDecimal en string)
   * sont tolérées et coercées via `Number()`.
   */
  y: number | string | null;
}

function coerceY(v: number | string | null): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface Series {
  /** Identifiant interne (clé React). */
  id: string;
  /** Libellé affiché dans la légende (ex. "Systolique"). */
  label: string;
  /** Couleur de la ligne — utiliser un token CSS (var(--primary), …). */
  color: string;
  points: SeriesPoint[];
}

interface EvolutionChartProps {
  /** Une ou plusieurs séries partageant le même axe Y (ex. TA sys + dia). */
  series: Series[];
  /** Unité affichée sur l'axe Y et dans le tooltip (ex. "mmHg"). */
  unit?: string | undefined;
  /** Hauteur en pixels — défaut 140. */
  height?: number | undefined;
  /**
   * Plage normale [min, max] — bande ombrée en arrière-plan.
   * Les valeurs en dehors restent visibles, juste sans fond.
   */
  normalRange?: [number, number] | undefined;
  /**
   * Bornes Y forcées. Sinon, calculées sur les données + 10% de marge.
   * Utile pour SpO₂ (0–100) ou T° (35–42).
   */
  yDomain?: [number, number] | undefined;
  /**
   * Format custom des valeurs Y (ex. (v) => v.toFixed(1)). Défaut : `String`.
   */
  formatY?: ((v: number) => string) | undefined;
  /** Ariane label pour l'élément svg. */
  ariaLabel?: string | undefined;
}

interface NormalizedPoint {
  x: number; // px
  y: number; // px (null si point absent)
  raw: number;
  date: Date;
  seriesId: string;
  seriesLabel: string;
  seriesColor: string;
}

const PADDING = { top: 10, right: 12, bottom: 22, left: 38 };

/**
 * Default Y-tick formatter — toFixed(1) puis on retire un ".0" final.
 * Évite les "21.93333333" qui apparaissaient avec `String(v)` sur des
 * graduations calculées par interpolation linéaire.
 */
function defaultFormatY(v: number): string {
  if (!Number.isFinite(v)) return '';
  const s = v.toFixed(1);
  return s.endsWith('.0') ? s.slice(0, -2) : s;
}

export function EvolutionChart({
  series,
  unit = '',
  height = 140,
  normalRange,
  yDomain,
  formatY = defaultFormatY,
  ariaLabel,
}: EvolutionChartProps) {
  const [hover, setHover] = useState<NormalizedPoint | null>(null);

  // Largeur fluide via viewBox — on raisonne en coordonnées 600×height puis
  // on laisse le navigateur stretcher horizontalement avec preserveAspectRatio.
  const W = 600;
  const H = height;

  const allPoints = series.flatMap((s) =>
    s.points
      .map((p) => ({ p, n: coerceY(p.y) }))
      .filter((entry): entry is { p: SeriesPoint; n: number } => entry.n != null)
      .map(({ p, n }) => ({
        date: typeof p.x === 'string' ? new Date(p.x) : p.x,
        y: n,
        seriesId: s.id,
        seriesLabel: s.label,
        seriesColor: s.color,
      })),
  );

  const { xMin, xMax, yMin, yMax, hasData } = useMemo(() => {
    if (allPoints.length === 0) {
      return { xMin: 0, xMax: 1, yMin: 0, yMax: 1, hasData: false };
    }
    const xs = allPoints.map((p) => p.date.getTime());
    const ys = allPoints.map((p) => p.y);
    const xLow = Math.min(...xs);
    const xHigh = Math.max(...xs);
    const dataLow = Math.min(...ys);
    const dataHigh = Math.max(...ys);
    let yLow: number;
    let yHigh: number;
    if (yDomain) {
      // yDomain est une PRÉFÉRENCE, pas une borne dure : si une mesure est en
      // dehors (ex. T° 33°C dans une plage suggérée [35,41], cas hypothermie
      // OU saisie aberrante en test), on élargit pour ne pas clipper le point.
      yLow = Math.min(yDomain[0], dataLow);
      yHigh = Math.max(yDomain[1], dataHigh);
    } else {
      yLow = dataLow;
      yHigh = dataHigh;
    }
    const span = Math.max(yHigh - yLow, 1);
    if (yDomain && (dataLow < yDomain[0] || dataHigh > yDomain[1])) {
      yLow -= span * 0.05;
      yHigh += span * 0.05;
    } else if (!yDomain) {
      yLow -= span * 0.1;
      yHigh += span * 0.1;
    }
    return {
      xMin: xLow,
      xMax: xHigh === xLow ? xLow + 1 : xHigh,
      yMin: yLow,
      yMax: yHigh,
      hasData: true,
    };
  }, [allPoints, yDomain]);

  if (!hasData) {
    return (
      <div
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

  function xPx(t: number): number {
    return (
      PADDING.left + ((t - xMin) / (xMax - xMin)) * (W - PADDING.left - PADDING.right)
    );
  }
  function yPx(v: number): number {
    return (
      PADDING.top + (1 - (v - yMin) / (yMax - yMin)) * (H - PADDING.top - PADDING.bottom)
    );
  }

  // Path data pour chaque série — sépare les nulls par "M" pour ne pas relier
  // au-dessus d'un trou.
  const seriesPaths = series.map((s) => {
    let d = '';
    let penUp = true;
    for (const p of s.points) {
      const n = coerceY(p.y);
      if (n == null) {
        penUp = true;
        continue;
      }
      const date = typeof p.x === 'string' ? new Date(p.x) : p.x;
      const cmd = penUp ? 'M' : 'L';
      d += `${cmd}${xPx(date.getTime()).toFixed(1)},${yPx(n).toFixed(1)} `;
      penUp = false;
    }
    return { id: s.id, label: s.label, color: s.color, d };
  });

  // Y axis ticks — 4 graduations.
  const yTicks: { v: number; px: number }[] = [];
  for (let i = 0; i <= 3; i++) {
    const v = yMin + ((yMax - yMin) * i) / 3;
    yTicks.push({ v, px: yPx(v) });
  }

  // X axis ticks — show first, middle, last to avoid clutter.
  const xTicks: { t: number; px: number; label: string }[] = [];
  const xValues =
    allPoints.length === 1
      ? [allPoints[0]!.date.getTime()]
      : allPoints.length === 2
      ? [xMin, xMax]
      : [xMin, (xMin + xMax) / 2, xMax];
  for (const t of xValues) {
    xTicks.push({
      t,
      px: xPx(t),
      label: new Date(t).toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit' }),
    });
  }

  // Bande "plage normale".
  const normalBand =
    normalRange != null
      ? {
          y: yPx(normalRange[1]),
          height: yPx(normalRange[0]) - yPx(normalRange[1]),
        }
      : null;

  // Rectangles overlay invisibles pour le hover (1 par point).
  const hoverTargets: NormalizedPoint[] = allPoints.map((p) => ({
    x: xPx(p.date.getTime()),
    y: yPx(p.y),
    raw: p.y,
    date: p.date,
    seriesId: p.seriesId,
    seriesLabel: p.seriesLabel,
    seriesColor: p.seriesColor,
  }));

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel}
        // overflow: hidden — clip les valeurs hors yDomain (ex. T° à 22°C dans
        // une plage [35,41]) pour ne pas faire fuir la ligne sous la carte.
        style={{ width: '100%', height, display: 'block', overflow: 'hidden' }}
      >
        {/* plage normale */}
        {normalBand && (
          <rect
            x={PADDING.left}
            y={normalBand.y}
            width={W - PADDING.left - PADDING.right}
            height={Math.max(normalBand.height, 0)}
            fill="var(--primary)"
            opacity={0.06}
          />
        )}

        {/* grille horizontale + axe Y */}
        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line
              x1={PADDING.left}
              x2={W - PADDING.right}
              y1={t.px}
              y2={t.px}
              stroke="var(--border)"
              strokeDasharray="2 3"
            />
            <text
              x={PADDING.left - 6}
              y={t.px + 3}
              textAnchor="end"
              fontSize="10"
              fill="var(--ink-3)"
            >
              {formatY(t.v)}
            </text>
          </g>
        ))}

        {/* axe X labels */}
        {xTicks.map((t, i) => (
          <text
            key={`x-${i}`}
            x={t.px}
            y={H - 6}
            textAnchor="middle"
            fontSize="10"
            fill="var(--ink-3)"
          >
            {t.label}
          </text>
        ))}

        {/* lignes des séries */}
        {seriesPaths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            fill="none"
            stroke={p.color}
            strokeWidth={1.6}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* points */}
        {hoverTargets.map((p, i) => (
          <circle
            key={`pt-${i}`}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={p.seriesColor}
          />
        ))}

        {/* zones de hover invisibles */}
        {hoverTargets.map((p, i) => (
          <circle
            key={`hover-${i}`}
            cx={p.x}
            cy={p.y}
            r={10}
            fill="transparent"
            onMouseEnter={() => setHover(p)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}
      </svg>

      {/* tooltip — positionné au-dessus du point survolé. */}
      {hover && (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: `${(hover.x / W) * 100}%`,
            top: hover.y - 36,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            background: 'var(--ink)',
            color: '#fff',
            fontSize: 11,
            padding: '4px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ fontWeight: 600 }}>
            {hover.seriesLabel} : {formatY(hover.raw)}
            {unit && ` ${unit}`}
          </div>
          <div style={{ opacity: 0.7, fontSize: 10 }}>
            {hover.date.toLocaleDateString('fr-MA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
        </div>
      )}

      {/* fallback accessible */}
      <table style={{ position: 'absolute', left: -9999, top: -9999 }}>
        <caption>{ariaLabel ?? 'Évolution'}</caption>
        <thead>
          <tr>
            <th>Date</th>
            {series.map((s) => (
              <th key={s.id}>
                {s.label} {unit && `(${unit})`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(() => {
            const dates = Array.from(
              new Set(
                allPoints.map((p) => p.date.toISOString()),
              ),
            ).sort();
            return dates.map((d) => (
              <tr key={d}>
                <td>{new Date(d).toLocaleString('fr-MA')}</td>
                {series.map((s) => {
                  const pt = s.points.find((p) => {
                    const dt = typeof p.x === 'string' ? new Date(p.x) : p.x;
                    return dt.toISOString() === d;
                  });
                  const n = pt ? coerceY(pt.y) : null;
                  return <td key={s.id}>{n != null ? formatY(n) : '—'}</td>;
                })}
              </tr>
            ));
          })()}
        </tbody>
      </table>
    </div>
  );
}
