/**
 * BiologicalTrendsPanel — V047.
 *
 * Affiche une mini-courbe par analyte saisi pour le patient (Hb, Plaquettes,
 * Glycémie…). Quand la même analyse est re-prescrite plusieurs fois et que
 * le médecin re-saisit les valeurs, le graphe trace leur évolution.
 *
 * Implémentation : SVG manuel — pas de dépendance graphing. Une courbe par
 * série (TrendSeries), normalisation Y locale à la série, axe X = ordre
 * temporel des points. C'est volontairement minimal — un chart riche
 * (zoom, tooltip riche, comparaison multi-séries) pourrait venir plus tard
 * via recharts si le besoin se confirme.
 */
import { useResultTrends, type TrendSeries } from '@/features/prescription/hooks/useResultValues';

const W = 340;
const H = 80;
const PAD = 6;

function formatPoint(p: { recordedAt: string; value: number; unit: string | null }) {
  const d = new Date(p.recordedAt);
  const date = d.toLocaleDateString('fr-MA', { day: '2-digit', month: 'short' });
  return `${date} : ${p.value}${p.unit ? ' ' + p.unit : ''}`;
}

function MiniChart({ series }: { series: TrendSeries }) {
  const points = series.points;
  if (points.length === 0) return null;

  const values = points.map((p) => Number(p.value));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // évite division par 0 si toutes valeurs égales

  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const xy = points.map((p, i) => {
    const x =
      points.length === 1
        ? PAD + innerW / 2
        : PAD + (i / (points.length - 1)) * innerW;
    const y = PAD + innerH - ((Number(p.value) - min) / range) * innerH;
    return { x, y, p };
  });

  const path = xy.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const last = points[points.length - 1]!;

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: 12,
        background: 'var(--surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
      data-testid={`trend-${series.analyte}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{series.analyte}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
          Dernière : <strong>{last.value}</strong>
          {last.unit ? ` ${last.unit}` : ''}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
        {points.length} mesure{points.length > 1 ? 's' : ''} · min {min} · max {max}
      </div>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Évolution ${series.analyte}`}
        style={{ display: 'block' }}
      >
        {/* Min / max grid lines */}
        <line x1={PAD} y1={PAD} x2={W - PAD} y2={PAD} stroke="var(--border-soft)" strokeDasharray="2 3" />
        <line
          x1={PAD}
          y1={H - PAD}
          x2={W - PAD}
          y2={H - PAD}
          stroke="var(--border-soft)"
          strokeDasharray="2 3"
        />
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.5} />
        {xy.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill="var(--primary)">
            <title>{formatPoint(pt.p)}</title>
          </circle>
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: 'var(--ink-3)',
        }}
      >
        <span>
          {new Date(points[0]!.recordedAt).toLocaleDateString('fr-MA', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
        <span>
          {new Date(last.recordedAt).toLocaleDateString('fr-MA', {
            day: '2-digit',
            month: 'short',
          })}
        </span>
      </div>
    </div>
  );
}

export function BiologicalTrendsPanel({ patientId }: { patientId: string }) {
  const { series, isLoading, error } = useResultTrends(patientId);

  if (isLoading) {
    return (
      <div style={{ color: 'var(--ink-3)', fontSize: 12, padding: 12 }}>
        Chargement de l'évolution…
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ color: 'var(--danger)', fontSize: 12, padding: 12 }}>{error}</div>
    );
  }

  // On regroupe : multi-mesures vs mesure unique. Seules les séries avec
  // ≥ 2 points méritent un graphe ; les autres sont listées en bas comme
  // "dernière valeur connue".
  const trended = series.filter((s) => s.points.length >= 2);
  const oneShot = series.filter((s) => s.points.length === 1);

  if (series.length === 0) {
    return (
      <div
        style={{
          padding: 18,
          textAlign: 'center',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          fontSize: 13,
          color: 'var(--ink-3)',
        }}
        data-testid="trends-empty"
      >
        Aucun résultat saisi pour ce patient. Les valeurs entrées sur les bons
        d'analyses apparaîtront ici, avec une courbe d'évolution quand la même
        analyse aura été re-prescrite.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} data-testid="biological-trends">
      {trended.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Évolution
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: 10,
            }}
          >
            {trended.map((s) => (
              <MiniChart key={s.analyte} series={s} />
            ))}
          </div>
        </div>
      )}
      {oneShot.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--ink-3)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}
          >
            Dernière valeur (mesure unique)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {oneShot.map((s) => {
              const p = s.points[0]!;
              return (
                <div
                  key={s.analyte}
                  style={{
                    display: 'flex',
                    gap: 12,
                    fontSize: 13,
                    padding: '6px 10px',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 6,
                    background: 'var(--surface)',
                  }}
                >
                  <span style={{ fontWeight: 600, minWidth: 120 }}>{s.analyte}</span>
                  <span>
                    {p.value}
                    {p.unit ? ` ${p.unit}` : ''}
                  </span>
                  <span style={{ color: 'var(--ink-3)', marginLeft: 'auto', fontSize: 11.5 }}>
                    {new Date(p.recordedAt).toLocaleDateString('fr-MA', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
