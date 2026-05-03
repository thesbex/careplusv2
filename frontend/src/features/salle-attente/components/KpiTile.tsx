/**
 * KpiTile — a single KPI panel used in the 4-column stat grid.
 * Ported from the .map(c => …) block in design/prototype/screens/salle-attente.jsx:23–37.
 */
import type { QueueKpi } from '../types';

interface KpiTileProps {
  kpi: QueueKpi;
}

export function KpiTile({ kpi }: KpiTileProps) {
  return (
    <div className="panel sa-kpi-tile">
      <div className="sa-kpi-label">{kpi.label}</div>
      <div className="sa-kpi-value-row">
        <span className="sa-kpi-value tnum">{kpi.value}</span>
        {kpi.unit && <span className="sa-kpi-unit">{kpi.unit}</span>}
      </div>
      <div className="sa-kpi-sub">{kpi.sub}</div>
    </div>
  );
}
