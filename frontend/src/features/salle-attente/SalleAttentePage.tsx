/**
 * Screen 04 — Salle d'attente (desktop).
 * Fully wired: queue polling, check-in via CTA, start consultation via CTA.
 */
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Avatar } from '@/components/ui/Avatar';
import { Print, Plus } from '@/components/icons';
import { KpiTile } from './components/KpiTile';
import { QueueRow } from './components/QueueRow';
import { useQueue } from './hooks/useQueue';
import { useCheckIn } from './hooks/useCheckIn';
import { useStartConsultation } from './hooks/useStartConsultation';
import type { QueueEntry } from './types';
import { useAuthStore } from '@/lib/auth/authStore';
import './salle-attente.css';

export default function SalleAttentePage() {
  const navigate = useNavigate();
  const { queue, kpis, upcoming } = useQueue();
  const { checkIn, isPending: isCheckingIn } = useCheckIn();
  const { startConsultation, isPending: isStarting } = useStartConsultation();
  // QA3-3 v1 — backward-compat: legacy sessions keep all CTAs visible.
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canDeclareArrival = userPerms == null || userPerms.includes('ARRIVAL_DECLARE');
  const canRecordVitals = userPerms == null || userPerms.includes('VITALS_RECORD');

  function handleTakeVitals(appointmentId: string) {
    navigate(`/constantes/${appointmentId}`);
  }

  async function handleStartConsult(entry: QueueEntry) {
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
      toast.error("Impossible de démarrer la consultation (rôle requis : médecin).");
    }
  }

  async function handleMarkArrived(appointmentId: string) {
    try {
      await checkIn(appointmentId);
      toast.success('Patient marqué comme arrivé.');
    } catch {
      toast.error("Échec de la déclaration d'arrivée.");
    }
  }

  const todayLabel = new Date().toLocaleDateString('fr-MA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Screen
      active="salle"
      title="Salle d'attente"
      sub={`${todayLabel} · ${queue.length} patient${queue.length > 1 ? 's' : ''} présent${queue.length > 1 ? 's' : ''}`}
      topbarRight={
        <>
          <Button onClick={() => window.print()}>
            <Print /> Liste
          </Button>
          <Button variant="primary" onClick={() => navigate('/agenda')}>
            <Plus /> Déclarer arrivée
          </Button>
        </>
      }
      onNavigate={(id) => {
        const map = {
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          params: '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <div className="sa-scroll scroll">
        <div className="sa-kpi-grid" role="region" aria-label="Indicateurs">
          {kpis.map((kpi) => (
            <KpiTile key={kpi.label} kpi={kpi} />
          ))}
        </div>

        <Panel>
          <PanelHeader>
            <span>File d'attente</span>
            <span className="sa-panel-sort">Trié par heure d'arrivée</span>
          </PanelHeader>
          <table className="sa-queue-table" aria-label="File d'attente">
            <thead className="sa-queue-thead">
              <tr>
                {['Patient', 'RDV', 'Arrivé à', 'Attente', 'Motif', 'Statut', 'Box'].map((h, i) => (
                  <th key={i} scope="col">
                    {h}
                  </th>
                ))}
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
              {queue.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: 24,
                      textAlign: 'center',
                      color: 'var(--ink-3)',
                      fontSize: 13,
                    }}
                  >
                    Aucun patient présent pour le moment.
                  </td>
                </tr>
              )}
              {queue.map((p, i) => (
                <QueueRow
                  key={p.appointmentId ?? `${p.name}-${i}`}
                  patient={p}
                  canRecordVitals={canRecordVitals}
                  onTakeVitals={handleTakeVitals}
                  onStartConsult={(entry) => {
                    void handleStartConsult(entry);
                  }}
                  onOpenConsult={() => {
                    toast.info('Ouvrir la consultation en cours — à câbler (J5 follow-up).');
                  }}
                  busy={isCheckingIn || isStarting}
                />
              ))}
            </tbody>
          </table>
        </Panel>

        {upcoming.length > 0 && (
          <>
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
                    {p.time} <span className="sa-upcoming-eta">· {p.eta}</span>
                  </span>
                  {canDeclareArrival && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isCheckingIn || !('appointmentId' in p)}
                      onClick={() => {
                        const apt = (p as unknown as { appointmentId?: string }).appointmentId;
                        if (apt) void handleMarkArrived(apt);
                      }}
                    >
                      Marquer arrivé
                    </Button>
                  )}
                </div>
              ))}
            </Panel>
          </>
        )}
      </div>
    </Screen>
  );
}
