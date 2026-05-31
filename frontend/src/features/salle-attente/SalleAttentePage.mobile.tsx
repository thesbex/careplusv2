/**
 * M04 — Salle d'attente mobile.
 * Ported from design/prototype/mobile/screens.jsx:MSalle (lines 283–362) verbatim.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Warn, Stetho, ChevronRight, Heart, Plus, Close } from '@/components/icons';
import { useQueue } from './hooks/useQueue';
import { useStartConsultation } from './hooks/useStartConsultation';
import { useCheckIn } from './hooks/useCheckIn';
import { api } from '@/lib/api/client';
import { useUpcomingToday } from './hooks/useUpcomingToday';
import { CancelAppointmentDialog } from './components/CancelAppointmentDialog';
import { AddWalkInDialog } from './components/AddWalkInDialog';
import { usePractitioners } from '@/features/agenda/hooks/usePractitioners';
import { groupQueueByPractitioner } from './queueGrouping';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import type { QueueEntry, WaitingPatientStatus } from './types';
import './salle-attente.css';

const MOBILE_STATUS_KEY: Record<WaitingPatientStatus, string> = {
  consult:  'salle.statusM.consult',
  vitals:   'salle.statusM.vitals',
  arrived:  'salle.statusM.arrived',
  waiting:  'salle.statusM.waiting',
  done:     'salle.statusM.done',
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
  const { t } = useT();
  const { queue, kpis } = useQueue();
  const { upcoming } = useUpcomingToday();
  const { startConsultation, isPending: isStarting } = useStartConsultation();
  const { checkIn, isPending: isCheckingIn } = useCheckIn();
  const { data: practitioners } = usePractitioners();
  const [cancelTarget, setCancelTarget] = useState<QueueEntry | null>(null);
  const [walkInOpen, setWalkInOpen] = useState(false);
  // QA9-11 mobile — no room for side-by-side columns at 390px, so we render a
  // horizontal chip filter to switch which doctor's queue is shown. Same ≥2
  // active-practitioners threshold as desktop. `selectedDoc === null` = "Tous".
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const activePractitioners = practitioners.filter((p) => p.active);
  const showDocFilter = activePractitioners.length >= 2;
  const columns = showDocFilter
    ? groupQueueByPractitioner(queue, activePractitioners, {
        unassigned: t('salle.unassigned'),
        doctorFallback: t('salle.doctorFallback'),
      })
    : [];
  // Constantes non-obligatoires : un MEDECIN qui tape un patient « arrivé » va
  // directement en consultation (les constantes restent saisissables depuis
  // la consultation). Les ASSISTANT/SECRETAIRE — dont c'est le rôle de saisir
  // les constantes — restent envoyés vers /constantes pour leur workflow.
  const userRoles = useAuthStore((s) => s.user?.roles) ?? [];
  const isMedecin = userRoles.includes('MEDECIN');

  async function handleDeclareArrival(appointmentId: string) {
    try {
      await checkIn(appointmentId);
      toast.success(t('salle.toast.markedArrived'));
    } catch {
      toast.error(t('salle.toast.checkInErr'));
    }
  }

  async function handleRowTap(entry: QueueEntry) {
    if (entry.status === 'done') return;
    if (entry.status === 'consult') {
      if (!entry.appointmentId) {
        toast.error(t('salle.toast.rdvNotFoundShort'));
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
      return;
    }
    if (entry.status === 'arrived') {
      if (!entry.appointmentId) {
        toast.error(t('salle.toast.rdvNotFoundShort'));
        return;
      }
      // Médecin → bypass /constantes : on démarre directement la consultation
      // pour ne pas le forcer à passer par la salle pré-consult. Assistant /
      // Secrétaire → /constantes (c'est leur tâche).
      if (isMedecin && entry.patientId) {
        try {
          const payload: { patientId: string; appointmentId?: string } = {
            patientId: entry.patientId,
            appointmentId: entry.appointmentId,
          };
          const created = await startConsultation(payload);
          void navigate(`/consultations/${created.id}`);
        } catch {
          toast.error(t('salle.toast.startConsultErr'));
        }
        return;
      }
      void navigate(`/constantes/${entry.appointmentId}`);
      return;
    }
    if (entry.status === 'waiting') {
      toast.info(t('salle.toast.notArrivedYet'));
      return;
    }
    // 'vitals' → start consultation
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
  // buildKpis() returns [waiting, avgWait]; index instead of label-match so the
  // lookup survives i18n (the label is now translated in useQueue).
  const avgWait = kpis[1]?.value ?? '0';

  // When the doctor filter is active and a specific doctor is picked, narrow
  // the rendered list to that doctor's column. "Tous" (null) keeps everyone.
  const visibleQueue =
    showDocFilter && selectedDoc !== null
      ? (columns.find((c) => c.practitionerId === selectedDoc)?.entries ?? [])
      : queue;

  return (
    <MScreen
      tab="salle"
      badges={{ salle: aVoir }}
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 2,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            {t('nav.salle')}
          </div>
          <button
            type="button"
            onClick={() => setWalkInOpen(true)}
            aria-label={t('salle.addWalkIn')}
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 34,
              padding: '0 12px',
              borderRadius: 999,
              border: '1px solid var(--primary)',
              background: 'var(--primary-soft)',
              color: 'var(--primary)',
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <Plus /> {t('salle.walkInShort')}
          </button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginBottom: 14 }}>
          {todayLabel} · {updatedLabel}
        </div>

        {/* KPI stat grid — 2×2, dérivé du même /queue que desktop. */}
        <div className="m-stat-grid">
          <div className="m-stat">
            <div className="m-stat-k">{t('salle.mStat.toSee')}</div>
            <div className="m-stat-v">{aVoir}</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">{t('salle.mStat.avgWait')}</div>
            <div className="m-stat-v">
              {avgWait}<span className="m-stat-u">{t('salle.kpi.min')}</span>
            </div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">{t('salle.mStat.inConsult')}</div>
            <div className="m-stat-v">{enConsult}</div>
          </div>
          <div className="m-stat">
            <div className="m-stat-k">{t('salle.mStat.totalQueue')}</div>
            <div className="m-stat-v">{queue.length}</div>
          </div>
        </div>

        {/* Queue list */}
        <div className="m-section-h">
          <h3>{t('salle.queue')}</h3>
          <span className="more">{t('salle.sort')}</span>
        </div>

        {/* QA9-11 — doctor filter chips (≥2 active practitioners). */}
        {showDocFilter && (
          <div className="sa-m-doc-chips" role="group" aria-label={t('salle.filterByDoctor')}>
            <button
              type="button"
              className={`sa-m-doc-chip${selectedDoc === null ? ' active' : ''}`}
              aria-pressed={selectedDoc === null}
              onClick={() => setSelectedDoc(null)}
            >
              {t('salle.all', { n: queue.length })}
            </button>
            {columns.map((col) => (
              <button
                key={col.practitionerId ?? 'unassigned'}
                type="button"
                className={`sa-m-doc-chip${selectedDoc === col.practitionerId ? ' active' : ''}`}
                aria-pressed={selectedDoc === col.practitionerId}
                onClick={() => setSelectedDoc(col.practitionerId)}
              >
                {t('salle.docChip', { label: col.label, n: col.entries.length })}
              </button>
            ))}
          </div>
        )}

        <div className="m-card">
          {visibleQueue.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--ink-3)',
                fontSize: 13,
              }}
            >
              {t('salle.emptyShort')}
            </div>
          ) : (
            visibleQueue.map((p, i) => {
              const isDone = p.status === 'done';
              const isArrived = p.status === 'arrived';
              const isVitals = p.status === 'vitals';
              const isConsult = p.status === 'consult';
              const interactive = !isDone;
              const canCancel = !!p.appointmentId && !isDone && !isConsult;
              return (
                <div
                  key={p.appointmentId ?? `${p.name}-${i}`}
                  style={{
                    position: 'relative',
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                  }}
                >
                <button
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
                    border: 0,
                    fontFamily: 'inherit',
                    font: 'inherit',
                    cursor: isDone ? 'default' : 'pointer',
                    opacity: isDone ? 0.6 : 1,
                    WebkitTapHighlightColor: 'transparent',
                    paddingRight: canCancel ? 44 : undefined,
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
                        {t(MOBILE_STATUS_KEY[p.status])}
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
                        {p.arrived !== '—'
                          ? t('salle.since', { time: p.arrived })
                          : t('salle.notArrived')}
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
                {canCancel && (
                  <button
                    type="button"
                    aria-label={t('salle.removeFromList', { name: p.name })}
                    onClick={() => setCancelTarget(p)}
                    style={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--danger, #b91c1c)',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <Close />
                  </button>
                )}
                </div>
              );
            })
          )}
        </div>

        <CancelAppointmentDialog
          open={cancelTarget !== null}
          onOpenChange={(open) => {
            if (!open) setCancelTarget(null);
          }}
          appointmentId={cancelTarget?.appointmentId ?? null}
          patientName={cancelTarget?.name ?? null}
        />

        <AddWalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} />

        {/* Upcoming today — not-yet-arrived appointments. Tap → check-in. */}
        {upcoming.length > 0 && (
          <>
            <div className="m-section-h" style={{ marginTop: 18 }}>
              <h3>{t('salle.upcomingM')}</h3>
              <span className="more">{upcoming.length}</span>
            </div>
            <div className="m-card">
              {upcoming.map((u, i) => (
                <button
                  key={u.appointmentId}
                  type="button"
                  className="m-row"
                  disabled={isCheckingIn}
                  onClick={() => {
                    void handleDeclareArrival(u.appointmentId);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 0,
                    borderTop: i === 0 ? 'none' : '1px solid var(--border-soft)',
                    fontFamily: 'inherit',
                    font: 'inherit',
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                  aria-label={t('salle.declareArrivalOf', { name: u.patientName })}
                >
                  <div className="sa-m-avatar" aria-hidden="true">
                    {initials(u.patientName)}
                  </div>
                  <div className="m-row-pri">
                    <div className="m-row-main">{u.patientName}</div>
                    <div className="m-row-sub">
                      {u.time} · {u.eta}
                      {u.reason ? ` · ${u.reason}` : ''}
                    </div>
                  </div>
                  <span
                    className="m-pill"
                    aria-hidden="true"
                    style={{
                      background: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      gap: 4,
                    }}
                  >
                    <Plus /> {t('salle.arrival')}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </MScreen>
  );
}
