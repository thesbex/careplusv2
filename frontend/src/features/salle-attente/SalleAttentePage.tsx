/**
 * Screen 04 — Salle d'attente (desktop).
 * Fully wired: queue polling, check-in via CTA, start consultation via CTA.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Avatar } from '@/components/ui/Avatar';
import { Print, Plus } from '@/components/icons';
import { KpiTile } from './components/KpiTile';
import { QueueRow } from './components/QueueRow';
import { QueueColumnCard } from './components/QueueColumnCard';
import { CancelAppointmentDialog } from './components/CancelAppointmentDialog';
import { AddWalkInDialog } from './components/AddWalkInDialog';
import { useQueue } from './hooks/useQueue';
import { useUpcomingToday } from './hooks/useUpcomingToday';
import { useCheckIn } from './hooks/useCheckIn';
import { useStartConsultation } from './hooks/useStartConsultation';
import { usePractitioners } from '@/features/agenda/hooks/usePractitioners';
import { groupQueueByPractitioner } from './queueGrouping';
import type { QueueEntry } from './types';
import { useAuthStore } from '@/lib/auth/authStore';
import { api } from '@/lib/api/client';
import { useT } from '@/lib/i18n/I18nProvider';
import './salle-attente.css';

export default function SalleAttentePage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { queue, kpis } = useQueue();
  const { upcoming } = useUpcomingToday();
  const { checkIn, isPending: isCheckingIn } = useCheckIn();
  const { startConsultation, isPending: isStarting } = useStartConsultation();
  const { data: practitioners } = usePractitioners();
  // QA3-3 v1 — backward-compat: legacy sessions keep all CTAs visible.
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canDeclareArrival = userPerms == null || userPerms.includes('ARRIVAL_DECLARE');
  const canRecordVitals = userPerms == null || userPerms.includes('VITALS_RECORD');

  const [cancelTarget, setCancelTarget] = useState<QueueEntry | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  // QA9-11 — split the queue into per-doctor columns once the cabinet runs
  // ≥2 active practitioners. Below that threshold (solo cabinet, or a cloisonné
  // MEDECIN who only sees themselves), keep the original flat table.
  const activePractitioners = practitioners.filter((p) => p.active);
  const showColumns = activePractitioners.length >= 2;
  const columns = showColumns
    ? groupQueueByPractitioner(queue, activePractitioners, {
        unassigned: t('salle.unassigned'),
        doctorFallback: t('salle.doctorFallback'),
      })
    : [];

  function handleTakeVitals(appointmentId: string) {
    navigate(`/constantes/${appointmentId}`);
  }

  async function handleStartConsult(entry: QueueEntry) {
    if (!entry.patientId) {
      toast.error(t('salle.toast.patientNotFound'));
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
      toast.error(t('salle.toast.startConsultRoleErr'));
    }
  }

  async function handleMarkArrived(appointmentId: string) {
    try {
      await checkIn(appointmentId);
      toast.success(t('salle.toast.markedArrived'));
    } catch {
      toast.error(t('salle.toast.checkInErr'));
    }
  }

  async function handleOpenConsult(entry: QueueEntry) {
    if (!entry.appointmentId) {
      toast.error(t('salle.toast.rdvNotFound'));
      return;
    }
    try {
      const consult = await api
        .get<{ id: string }>(`/consultations/by-appointment/${entry.appointmentId}`)
        .then((r) => r.data);
      void navigate(`/consultations/${consult.id}`);
    } catch {
      toast.error(t('salle.toast.openConsultErr'));
    }
  }

  const todayLabel = new Date().toLocaleDateString('fr-MA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  function renderRow(p: QueueEntry, i: number) {
    return (
      <QueueRow
        key={p.appointmentId ?? `${p.name}-${i}`}
        patient={p}
        canRecordVitals={canRecordVitals}
        onTakeVitals={handleTakeVitals}
        onStartConsult={(entry) => {
          void handleStartConsult(entry);
        }}
        onOpenConsult={(entry) => {
          void handleOpenConsult(entry);
        }}
        onCancel={(entry) => setCancelTarget(entry)}
        busy={isCheckingIn || isStarting}
      />
    );
  }

  function renderCard(p: QueueEntry, i: number) {
    return (
      <QueueColumnCard
        key={p.appointmentId ?? `${p.name}-${i}`}
        patient={p}
        canRecordVitals={canRecordVitals}
        onTakeVitals={handleTakeVitals}
        onStartConsult={(entry) => {
          void handleStartConsult(entry);
        }}
        onOpenConsult={(entry) => {
          void handleOpenConsult(entry);
        }}
        onCancel={(entry) => setCancelTarget(entry)}
        busy={isCheckingIn || isStarting}
      />
    );
  }

  const tableHead = (
    <thead className="sa-queue-thead">
      <tr>
        {[
          t('salle.colPatient'),
          t('salle.colRdv'),
          t('salle.colArrivedAt'),
          t('salle.colWait'),
          t('salle.colReason'),
          t('salle.colStatus'),
          t('salle.colRoom'),
        ].map((h, i) => (
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
            {t('salle.colActions')}
          </span>
        </th>
      </tr>
    </thead>
  );

  return (
    <Screen
      active="salle"
      title={t('nav.salle')}
      sub={t(queue.length > 1 ? 'salle.subtitlePlural' : 'salle.subtitle', {
        date: todayLabel,
        n: queue.length,
      })}
      topbarRight={
        <>
          <Button onClick={() => window.print()}>
            <Print /> {t('salle.print')}
          </Button>
          <Button onClick={() => setWalkInOpen(true)}>
            <Plus /> {t('salle.addWalkIn')}
          </Button>
          <Button variant="primary" onClick={() => navigate('/agenda')}>
            <Plus /> {t('salle.declareArrival')}
          </Button>
        </>
      }
      onNavigate={(id) => {
        const map = {
          dashboard: '/dashboard',
          agenda: '/agenda',
          patients: '/patients',
          salle: '/salle',
          consult: '/consultations',
          factu: '/facturation',
          vaccinations: '/vaccinations',
          grossesses: '/grossesses',
          stock: '/stock',
          queueLab: '/queue/lab',
          queueRadio: '/queue/radio',
          messages: '/messages',
          catalogue: '/catalogue',
          params: '/parametres',
        } as const;
        navigate(map[id]);
      }}
    >
      <div className="sa-scroll scroll">
        <div className="sa-kpi-grid" role="region" aria-label={t('salle.kpiRegion')}>
          {kpis.map((kpi) => (
            <KpiTile key={kpi.label} kpi={kpi} />
          ))}
        </div>

        {showColumns ? (
          <div className="sa-columns" role="region" aria-label={t('salle.queueByDoctor')}>
            {columns.map((col) => (
              <Panel key={col.practitionerId ?? 'unassigned'} className="sa-col">
                <div className="sa-col-head">
                  <span className="sa-col-title">{col.label}</span>
                  <span className="sa-col-count">
                    {t(
                      col.entries.length > 1 ? 'salle.colCountPlural' : 'salle.colCount',
                      { n: col.entries.length },
                    )}
                  </span>
                </div>
                {col.entries.length === 0 ? (
                  <div className="sa-col-empty">{t('salle.colEmpty')}</div>
                ) : (
                  <div
                    className="sa-col-list"
                    role="list"
                    aria-label={t('salle.queueForDoctor', { label: col.label })}
                  >
                    {col.entries.map((p, i) => renderCard(p, i))}
                  </div>
                )}
              </Panel>
            ))}
          </div>
        ) : (
          <Panel>
            <PanelHeader>
              <span>{t('salle.queue')}</span>
              <span className="sa-panel-sort">{t('salle.sortedByArrival')}</span>
            </PanelHeader>
            <table className="sa-queue-table" aria-label={t('salle.queue')}>
              {tableHead}
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
                      {t('salle.empty')}
                    </td>
                  </tr>
                )}
                {queue.map((p, i) => renderRow(p, i))}
              </tbody>
            </table>
          </Panel>
        )}

        <CancelAppointmentDialog
          open={cancelTarget !== null}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          appointmentId={cancelTarget?.appointmentId ?? null}
          patientName={cancelTarget?.name ?? null}
        />

        <AddWalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />

        {upcoming.length > 0 && (
          <>
            <div className="sa-upcoming-h">{t('salle.upcoming')}</div>
            <Panel className="sa-upcoming-panel">
              {upcoming.map((p) => (
                <div key={p.appointmentId} className="sa-upcoming-row">
                  <Avatar
                    initials={p.patientName
                      .split(' ')
                      .map((w) => w[0] ?? '')
                      .slice(0, 2)
                      .join('')}
                    size="sm"
                    style={{ background: 'var(--border-strong)', color: 'var(--ink-2)' }}
                  />
                  <span className="sa-upcoming-name">{p.patientName}</span>
                  <span className="sa-upcoming-time tnum">
                    {p.time} <span className="sa-upcoming-eta">· {p.eta}</span>
                  </span>
                  {canDeclareArrival && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isCheckingIn}
                      onClick={() => {
                        void handleMarkArrived(p.appointmentId);
                      }}
                    >
                      {t('salle.markArrived')}
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
