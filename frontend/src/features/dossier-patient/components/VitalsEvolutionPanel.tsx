/**
 * VitalsEvolutionPanel — onglet "Constantes" du dossier patient.
 *
 * Affiche un graphe d'évolution par constante (TA sys+dia, FC, T°, SpO₂,
 * poids, IMC, glycémie). Source : GET /patients/{id}/vitals — toute la base
 * d'enregistrements de constantes du patient à travers ses consultations.
 *
 * Les constantes sont attachées aux consultations (champ consultationId) ;
 * ce panneau les agrège juste pour offrir une vue longitudinale.
 */
import { Panel } from '@/components/ui/Panel';
import { usePatientVitalsHistory } from '../hooks/usePatientVitalsHistory';
import { EvolutionChart, type Series } from './EvolutionChart';
import type { VitalsApi } from '@/features/consultation/hooks/useLatestVitals';

interface VitalsEvolutionPanelProps {
  patientId: string;
}

interface ChartCardProps {
  title: string;
  /** Dernière valeur affichée à droite du titre. `null` = "—". */
  current: string | null;
  unit: string;
  series: Series[];
  normalRange?: [number, number] | undefined;
  yDomain?: [number, number] | undefined;
  formatY?: ((v: number) => string) | undefined;
  /** Sous-titre court sous le titre (ex. "20 dernières mesures"). */
  hint?: string | undefined;
}

function ChartCard({
  title,
  current,
  unit,
  series,
  normalRange,
  yDomain,
  formatY,
  hint,
}: ChartCardProps) {
  return (
    <Panel>
      <div style={{ padding: '14px 16px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{title}</div>
            {hint && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>{hint}</div>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="tnum" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
              {current ?? '—'}
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {unit}
            </div>
          </div>
        </div>
        <EvolutionChart
          series={series}
          unit={unit}
          height={150}
          normalRange={normalRange}
          yDomain={yDomain}
          formatY={formatY}
          ariaLabel={`Évolution ${title}`}
        />
      </div>
    </Panel>
  );
}

function pick<K extends keyof VitalsApi>(
  history: VitalsApi[],
  key: K,
): { x: string; y: VitalsApi[K] }[] {
  return history.map((v) => ({ x: v.recordedAt, y: v[key] }));
}

function lastValue<K extends keyof VitalsApi>(
  history: VitalsApi[],
  key: K,
  fmt: (v: NonNullable<VitalsApi[K]>) => string = (v) => String(v),
): string | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const v = history[i]![key];
    if (v != null) return fmt(v as NonNullable<VitalsApi[K]>);
  }
  return null;
}

export function VitalsEvolutionPanel({ patientId }: VitalsEvolutionPanelProps) {
  const { history, isLoading } = usePatientVitalsHistory(patientId);

  if (isLoading) {
    return <div style={{ padding: 20, color: 'var(--ink-3)' }}>Chargement de l'historique…</div>;
  }

  if (history.length === 0) {
    return (
      <div
        style={{
          padding: '32px 20px',
          textAlign: 'center',
          color: 'var(--ink-3)',
          fontSize: 13,
        }}
      >
        Aucune constante enregistrée pour ce patient.
        <div style={{ fontSize: 11.5, marginTop: 4 }}>
          Les graphes apparaîtront dès la première saisie en consultation.
        </div>
      </div>
    );
  }

  // Helper — même série de couleurs pour tous les charts.
  const C_PRI = 'var(--primary)';
  const C_DIA = '#a8c5e8'; // bleu plus pâle pour la diastolique

  // ── TA : 2 séries (systolique + diastolique) ──────────────────────────────
  const sysPoints = pick(history, 'systolicMmhg').map((p) => ({ x: p.x, y: p.y }));
  const diaPoints = pick(history, 'diastolicMmhg').map((p) => ({ x: p.x, y: p.y }));
  const lastSys = lastValue(history, 'systolicMmhg');
  const lastDia = lastValue(history, 'diastolicMmhg');
  const taCurrent = lastSys && lastDia ? `${lastSys} / ${lastDia}` : null;

  // ── Autres constantes : 1 série chacune ──────────────────────────────────
  const fcPoints = pick(history, 'heartRateBpm').map((p) => ({ x: p.x, y: p.y }));
  const tPoints = pick(history, 'temperatureC').map((p) => ({ x: p.x, y: p.y }));
  const spo2Points = pick(history, 'spo2Percent').map((p) => ({ x: p.x, y: p.y }));
  const wPoints = pick(history, 'weightKg').map((p) => ({ x: p.x, y: p.y }));
  const bmiPoints = pick(history, 'bmi').map((p) => ({ x: p.x, y: p.y }));
  const glyPoints = pick(history, 'glycemiaGPerL').map((p) => ({ x: p.x, y: p.y }));

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Évolution des constantes</h3>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4 }}>
          {history.length} mesure{history.length > 1 ? 's' : ''} enregistrée
          {history.length > 1 ? 's' : ''} sur l'ensemble des consultations. Survol des points pour
          voir la valeur exacte et la date.
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 16,
        }}
      >
        <ChartCard
          title="Tension artérielle"
          current={taCurrent}
          unit="mmHg"
          hint="Systolique / Diastolique"
          series={[
            { id: 'sys', label: 'Systolique', color: C_PRI, points: sysPoints },
            { id: 'dia', label: 'Diastolique', color: C_DIA, points: diaPoints },
          ]}
          normalRange={[80, 130]}
        />

        <ChartCard
          title="Fréquence cardiaque"
          current={lastValue(history, 'heartRateBpm')}
          unit="bpm"
          series={[{ id: 'fc', label: 'FC', color: C_PRI, points: fcPoints }]}
          normalRange={[60, 100]}
        />

        <ChartCard
          title="Température"
          current={lastValue(history, 'temperatureC', (v) => v.toFixed(1).replace('.', ','))}
          unit="°C"
          series={[{ id: 't', label: 'T°', color: C_PRI, points: tPoints }]}
          yDomain={[35, 41]}
          normalRange={[36, 37.5]}
          formatY={(v) => v.toFixed(1).replace('.', ',')}
        />

        <ChartCard
          title="Saturation O₂"
          current={lastValue(history, 'spo2Percent')}
          unit="%"
          series={[{ id: 'spo2', label: 'SpO₂', color: C_PRI, points: spo2Points }]}
          yDomain={[85, 100]}
          normalRange={[95, 100]}
        />

        <ChartCard
          title="Poids"
          current={lastValue(history, 'weightKg', (v) => v.toFixed(1).replace('.', ','))}
          unit="kg"
          series={[{ id: 'w', label: 'Poids', color: C_PRI, points: wPoints }]}
          formatY={(v) => v.toFixed(1).replace('.', ',')}
        />

        <ChartCard
          title="IMC"
          current={lastValue(history, 'bmi', (v) => v.toFixed(1).replace('.', ','))}
          unit="kg/m²"
          hint="Plage normale 18,5 – 25"
          series={[{ id: 'bmi', label: 'IMC', color: C_PRI, points: bmiPoints }]}
          normalRange={[18.5, 25]}
          formatY={(v) => v.toFixed(1).replace('.', ',')}
        />

        <ChartCard
          title="Glycémie"
          current={lastValue(history, 'glycemiaGPerL', (v) => v.toFixed(2).replace('.', ','))}
          unit="g/L"
          hint="Mesures à jeun et post-prandiales confondues"
          series={[{ id: 'gly', label: 'Glycémie', color: C_PRI, points: glyPoints }]}
          normalRange={[0.7, 1.1]}
          formatY={(v) => v.toFixed(2).replace('.', ',')}
        />
      </div>
    </div>
  );
}
