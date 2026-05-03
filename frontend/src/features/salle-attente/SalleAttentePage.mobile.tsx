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
  const { queue, kpis } = useQueue();
  const todayLabel = new Date().toLocaleDateString('fr-MA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const updatedLabel = new Date().toLocaleTimeString('fr-MA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // Mobile shows a 4-tile KPI grid; the hook returns 2 generic KPIs so we
  // derive the remaining counts from the queue itself. Keeps a single source
  // of truth (the /queue endpoint) instead of a parallel hardcoded set.
  const aVoir = queue.filter((q) => q.status === 'arrived' || q.status === 'waiting' || q.status === 'vitals').length;
  const enConsult = queue.filter((q) => q.status === 'consult').length;
  const avgWait = kpis.find((k) => k.label === 'Attente moy.')?.value ?? '0';

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
          {todayLabel} · {updatedLabel}
        </div>

        {/* KPI stat grid — 2×2, dérivé du même /queue que desktop. */}
        <div className="m-stat-grid">
          <div className="m-stat">
            <div className="m-stat-k">À voir</div>
            <div className="m-stat-v">{aVoir}</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">Attente moy.</div>
            <div className="m-stat-v">
              {avgWait}<span className="m-stat-u">min</span>
            </div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">En consult.</div>
            <div className="m-stat-v">{enConsult}</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">Total file</div>
            <div className="m-stat-v">{queue.length}</div>
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
