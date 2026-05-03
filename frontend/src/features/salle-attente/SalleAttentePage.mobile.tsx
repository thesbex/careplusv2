/**
 * M04 — Salle d'attente mobile.
 * Ported from design/prototype/mobile/screens.jsx:MSalle (lines 283–362) verbatim.
 */
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Warn, Stetho, ChevronRight, Heart } from '@/components/icons';
import { useQueue } from './hooks/useQueue';
import { useStartConsultation } from './hooks/useStartConsultation';
import type { QueueEntry, WaitingPatientStatus } from './types';
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
  const { startConsultation, isPending: isStarting } = useStartConsultation();

  async function handleRowTap(entry: QueueEntry) {
    if (entry.status === 'done') return;
    if (entry.status === 'consult') {
      toast.info('Consultation en cours — ouvrez-la depuis l’onglet Consultations.');
      return;
    }
    if (entry.status === 'arrived') {
      if (!entry.appointmentId) {
        toast.error('RDV introuvable pour cette entrée.');
        return;
      }
      void navigate(`/constantes/${entry.appointmentId}`);
      return;
    }
    if (entry.status === 'waiting') {
      toast.info('Patient pas encore arrivé — déclarez son arrivée depuis l’agenda.');
      return;
    }
    // 'vitals' → start consultation
    if (!entry.patientId) {
      toast.error('Patient introuvable pour cette entrée.');
      return;
    }
    try {
      const payload: { patientId: string; appointmentId?: string } = {
        patientId: entry.patientId,
      };
      if (entry.appointmentId) payload.appointmentId = entry.appointmentId;
      const created = await startConsultation(payload);
      void navigate(`/consultations/${created.id}`);
    } catch {
      toast.error('Impossible de démarrer la consultation (rôle requis : médecin).');
    }
  }
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
      topbar={<MTopbar brand />}
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
          {queue.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              Aucun patient présent
            </div>
          ) : (
            queue.map((p, i) => {
              const isDone = p.status === 'done';
              const isArrived = p.status === 'arrived';
              const isVitals = p.status === 'vitals';
              const interactive = !isDone;
              return (
                <button
                  key={p.appointmentId ?? `${p.name}-${i}`}
                  type="button"
                  className="m-row"
                  disabled={isDone || isStarting}
                  onClick={() => {
                    void handleRowTap(p);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                    fontFamily: 'inherit',
                    font: 'inherit',
                    cursor: isDone ? 'default' : 'pointer',
                    opacity: isDone ? 0.6 : 1,
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
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

                  {/* Time + since + action affordance */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="sa-m-time-col">
                      <div className="m-row-time">{p.apt}</div>
                      <div className="sa-m-since">
                        {p.arrived !== '—' ? `Depuis ${p.arrived}` : 'pas arrivé'}
                      </div>
                    </div>
                    {interactive && (
                      <span
                        style={{
                          color:
                            isArrived || isVitals ? 'var(--primary)' : 'var(--ink-4)',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                        aria-hidden="true"
                      >
                        {isArrived ? <Heart /> : isVitals ? <Stetho /> : <ChevronRight />}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </MScreen>
  );
}
