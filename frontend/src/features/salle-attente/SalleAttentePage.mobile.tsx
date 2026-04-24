/**
 * M04 — Salle d'attente mobile.
 * Ported from design/prototype/mobile/screens.jsx:MSalle (lines 283–362) verbatim.
 */
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Warn } from '@/components/icons';
import { useQueue } from './hooks/useQueue';
import type { WaitingPatientStatus } from './types';
import './salle-attente.css';

const MOBILE_STATUS_LABEL: Record<WaitingPatientStatus, string> = {
  consult:  'En consult.',
  vitals:   'Constantes',
  arrived:  'Arrivé',
  waiting:  'Confirmé',
  done:     'Terminé',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('');
}

export default function SalleAttenteMobilePage() {
  const navigate = useNavigate();
  const { queue } = useQueue();

  return (
    <MScreen
      tab="salle"
      badges={{ salle: queue.length }}
      topbar={
        <MTopbar
          brand
          right={
            <>
              <MIconBtn icon="Search" label="Rechercher" />
              <MIconBtn icon="Bell" badge label="Notifications" />
            </>
          }
        />
      }
      onTabChange={(tab: MobileTab) => {
        const map: Record<MobileTab, string> = {
          agenda:   '/agenda',
          salle:    '/salle',
          patients: '/patients',
          factu:    '/facturation',
          menu:     '/parametres',
        };
        navigate(map[tab]);
      }}
    >
      <div className="mb-pad">
        {/* Screen heading */}
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 2 }}>
          Salle d'attente
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>
          Jeudi 24 avril · 10:24
        </div>

        {/* KPI stat grid — 2×2 */}
        <div className="m-stat-grid">
          <div className="m-stat">
            <div className="m-stat-k">À voir</div>
            <div className="m-stat-v">4</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">Attente moy.</div>
            <div className="m-stat-v">
              12<span className="m-stat-u">min</span>
            </div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">En consult.</div>
            <div className="m-stat-v">1</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">Retard</div>
            <div className="m-stat-v" style={{ color: 'var(--amber)' }}>
              +7<span className="m-stat-u">min</span>
            </div>
          </div>
        </div>

        {/* Queue list */}
        <div className="m-section-h">
          <h3>File d'attente</h3>
          <span className="more">Trier</span>
        </div>

        <div className="m-card">
          {queue.map((p) => (
            <div key={p.name} className="m-row">
              {/* Avatar */}
              <div className="sa-m-avatar" aria-hidden="true">
                {initials(p.name)}
              </div>

              {/* Name + pills */}
              <div className="m-row-pri">
                <div className="m-row-main">{p.name}</div>
                <div className="sa-m-pills-row">
                  <span className={`m-pill ${p.status}`}>
                    {MOBILE_STATUS_LABEL[p.status]}
                  </span>
                  {p.room && p.room !== '—' && (
                    <span className="sa-m-room">· {p.room}</span>
                  )}
                  {p.allergy && (
                    <span
                      className="m-pill allergy"
                      style={{ fontSize: 10, padding: '2px 6px' }}
                    >
                      <Warn /> {p.allergy}
                    </span>
                  )}
                </div>
              </div>

              {/* Time + since */}
              <div className="sa-m-time-col">
                <div className="m-row-time">{p.apt}</div>
                <div className="sa-m-since">
                  {p.arrived !== '—' ? `Depuis ${p.arrived}` : 'pas arrivé'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </MScreen>
  );
}
