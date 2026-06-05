import { useNavigate } from 'react-router-dom';
import { useT } from '@/lib/i18n/I18nProvider';
import { toMin } from '../fixtures';
import type { Appointment } from '../types';

/**
 * Rail latéral de l'agenda — iso maquette « careplus refresh - agenda (calm
 * premium) » (`.agrail`). Remplace l'ancien panneau « Arrivées du jour » par la
 * composition Calm Premium à 3 cartes :
 *   1. « Aujourd'hui » : compteur du jour + répartition par statut + barre de
 *      remplissage.
 *   2. « Prochains RDV » : les 3 prochains créneaux à venir.
 *   3. « Salle d'attente » (carte accent pleine) : nombre de patients en attente,
 *      cliquable vers /salle.
 *
 * Sémantique careplus conservée : on répartit par STATUT (confirmé / en attente /
 * en cours / terminé) plutôt que par type comme le mock — plus utile au comptoir.
 */
interface AgendaRailProps {
  /** Titre de la carte : « Aujourd'hui » si le jour en focus est aujourd'hui,
      sinon le nom du jour (ex. « Mercredi »). */
  title: string;
  /** Libellé date complet du jour en focus, ex. « Mardi 27 mai 2026 ». */
  todayLabel: string;
  /** RDV du jour en focus (selectedDay). */
  appointments: Appointment[];
  /** Patients réellement en salle d'attente (file réelle). */
  waitingCount: number;
  /** Heure courante « HH:MM » pour calculer les prochains RDV. */
  now: string;
}

/** Minutes ouvrées de référence pour le taux de remplissage : 08–19h − 2h pause. */
const WORK_MINUTES = (19 - 8) * 60 - 120; // 540

export function AgendaRail({ title, todayLabel, appointments, waitingCount, now }: AgendaRailProps) {
  const { t } = useT();
  const navigate = useNavigate();

  const total = appointments.length;
  const confirmed = appointments.filter((a) => a.status === 'confirmed').length;
  const waiting = appointments.filter((a) => a.status === 'arrived' || a.status === 'vitals').length;
  const inProgress = appointments.filter((a) => a.status === 'consult').length;
  const done = appointments.filter((a) => a.status === 'done').length;

  const booked = appointments.reduce((sum, a) => sum + a.dur, 0);
  const fillPct = Math.min(100, Math.round((booked / WORK_MINUTES) * 100));

  const nowM = toMin(now);
  const next = [...appointments]
    .filter((a) => toMin(a.start) >= nowM && a.status !== 'done')
    .sort((a, b) => toMin(a.start) - toMin(b.start))
    .slice(0, 3);

  const waitingLabel =
    waitingCount === 1 ? t('agenda.rail.waitingSuffixOne') : t('agenda.rail.waitingSuffix');

  return (
    <div className="agrail scroll">
      {/* 1 — Aujourd'hui : compteur + répartition statuts + remplissage */}
      <div className="agrail-card">
        <div className="agrail-h">
          <div>
            <div className="t">{title}</div>
            <div className="s">{todayLabel}</div>
          </div>
          <span className="agrail-big tnum">{total}</span>
        </div>
        <div className="agstats">
          <div className="st">
            <span className="d" style={{ background: 'var(--ds2-navy)' }} />
            {t('agenda.rail.confirmed')}
            <b className="tnum">{confirmed}</b>
          </div>
          <div className="st">
            <span className="d" style={{ background: 'var(--ds2-amber)' }} />
            {t('agenda.rail.waiting')}
            <b className="tnum">{waiting}</b>
          </div>
          <div className="st">
            <span className="d" style={{ background: 'var(--ds2-green)' }} />
            {t('agenda.rail.inProgress')}
            <b className="tnum">{inProgress}</b>
          </div>
          <div className="st">
            <span className="d" style={{ background: 'var(--ds2-ink-4, #aaa59a)' }} />
            {t('agenda.rail.done')}
            <b className="tnum">{done}</b>
          </div>
        </div>
        <div className="agfill">
          <div className="agfill-bar">
            <i style={{ width: `${fillPct}%` }} />
          </div>
          <div className="agfill-lab">
            <span>{t('agenda.sidebar.stat.fillRate')}</span>
            <b className="tnum">{fillPct}%</b>
          </div>
        </div>
      </div>

      {/* 2 — Prochains RDV */}
      <div className="agrail-card">
        <div className="agrail-dsec">{t('agenda.rail.nextTitle')}<span className="ln" /></div>
        <div className="agnext">
          {next.length === 0 ? (
            <div className="agnext-empty">{t('agenda.rail.noNext')}</div>
          ) : (
            next.map((a, i) => (
              <div className="nx" key={`${a.start}-${i}`}>
                <span className="tm tnum">{a.start}</span>
                <div>
                  <b>{a.patient}</b>
                  <span>{a.reason && a.reason !== '—' ? a.reason : t('agenda.rail.toPlace')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 3 — Salle d'attente (carte accent, cliquable) */}
      <button
        type="button"
        className="agrail-card alt"
        onClick={() => navigate('/salle')}
        aria-label={t('agenda.arrivals.openWaitingRoom')}
      >
        <div className="t">{t('agenda.rail.waitingRoom')}</div>
        <div className="wait">
          <span className="big tnum">{waitingCount}</span>
          {waitingLabel}
        </div>
      </button>
    </div>
  );
}
