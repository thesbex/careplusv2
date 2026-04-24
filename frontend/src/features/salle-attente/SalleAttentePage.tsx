/**
 * Screen 04 — Salle d'attente (desktop).
 * Ported from design/prototype/screens/salle-attente.jsx verbatim.
 * Backend dependency: J5 check-in + queue module — currently uses fixtures via useQueue.
 */
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Avatar } from '@/components/ui/Avatar';
import { Print, Plus } from '@/components/icons';
import { KpiTile } from './components/KpiTile';
import { QueueRow } from './components/QueueRow';
import { useQueue } from './hooks/useQueue';
import './salle-attente.css';

export default function SalleAttentePage() {
  const navigate = useNavigate();
  const { queue, kpis, upcoming } = useQueue();

  return (
    <Screen
      active="salle"
      title="Salle d'attente"
      sub="Jeudi 23 avril 2026 · 4 patients présents"
      pageDate="09:47"
      topbarRight={
        <>
          <Button>
            <Print /> Liste
          </Button>
          <Button variant="primary">
            <Plus /> Déclarer arrivée
          </Button>
        </>
      }
      onNavigate={(id) => {
        const map = {
          agenda:   '/agenda',
          patients: '/patients',
          salle:    '/salle',
          consult:  '/consultations',
          factu:    '/facturation',
          params:   '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <div className="sa-scroll scroll">
        {/* KPI grid */}
        <div className="sa-kpi-grid" role="region" aria-label="Indicateurs">
          {kpis.map((kpi) => (
            <KpiTile key={kpi.label} kpi={kpi} />
          ))}
        </div>

        {/* Queue table */}
        <Panel>
          <PanelHeader>
            <span>File d'attente</span>
            <span className="sa-panel-sort">Trié par heure d'arrivée</span>
          </PanelHeader>
          <table className="sa-queue-table" aria-label="File d'attente">
            <thead className="sa-queue-thead">
              <tr>
                {['Patient', 'RDV', 'Arrivé à', 'Attente', 'Motif', 'Statut', 'Box'].map(
                  (h, i) => (
                    <th key={i} scope="col">
                      {h}
                    </th>
                  ),
                )}
                <th scope="col">
                  <span
                    style={{
                      position: 'absolute',
                      width: 1,
                      height: 1,
                      padding: 0,
                      margin: -1,
                      overflow: 'hidden',
                      clip: 'rect(0,0,0,0)',
                      whiteSpace: 'nowrap',
                      border: 0,
                    }}
                  >
                    Actions
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {queue.map((p) => (
                <QueueRow key={p.name} patient={p} />
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Upcoming — not yet arrived */}
        <div className="sa-upcoming-h">RDV prévus — pas encore arrivés</div>
        <Panel className="sa-upcoming-panel">
          {upcoming.map((p) => (
            <div key={p.name} className="sa-upcoming-row">
              <Avatar
                initials={p.name
                  .split(' ')
                  .map((w) => w[0] ?? '')
                  .slice(0, 2)
                  .join('')}
                size="sm"
                style={{ background: 'var(--border-strong)', color: 'var(--ink-2)' }}
              />
              <span className="sa-upcoming-name">{p.name}</span>
              <span className="sa-upcoming-time tnum">
                {p.time}{' '}
                <span className="sa-upcoming-eta">· {p.eta}</span>
              </span>
              <Button size="sm" variant="ghost">
                Marquer arrivé
              </Button>
            </div>
          ))}
        </Panel>
      </div>
    </Screen>
  );
}
