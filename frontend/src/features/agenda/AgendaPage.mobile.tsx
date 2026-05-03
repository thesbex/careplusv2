/**
 * M01 — Agenda mobile (single-day timeline with a horizontal day-tab strip).
 * Ported from design/prototype/mobile/screens.jsx:MAgenda.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Plus, Warn } from '@/components/icons';
import { useWeekAppointments } from './hooks/useAppointments';
import type { DayKey } from './types';

const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function todayKey(): DayKey {
  const dow = new Date().getDay(); // 0=Sun
  return dow === 0 ? 'lun' : (DAY_KEYS[dow - 1] ?? 'lun');
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmé',
  arrived: 'Arrivé',
  vitals: 'Arrivé',
  consult: 'En consult.',
  done: 'Terminé',
};

export default function AgendaMobilePage() {
  const navigate = useNavigate();
  const { days, appointments, isLoading } = useWeekAppointments();
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey);

  const dayAppointments = appointments.filter((a) => a.day === selectedDay);
  const selectedDayInfo = days.find((d) => d.key === selectedDay);

  return (
    <MScreen
      tab="agenda"
      topbar={
        <MTopbar
          brand
          left={<MIconBtn icon="Menu" label="Menu" />}
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
          agenda: '/agenda',
          salle: '/salle',
          patients: '/patients',
          factu: '/facturation',
          menu: '/parametres',
        };
        navigate(map[tab]);
      }}
      fab={
        <button
          className="m-fab"
          type="button"
          aria-label="Nouveau RDV"
          style={{ border: 0, cursor: 'pointer' }}
          onClick={() => navigate('/rdv/new')}
        >
          <Plus />
        </button>
      }
    >
      <div className="m-daytabs" role="tablist" aria-label="Jour">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`m-daytab ${d.key === selectedDay ? 'on' : ''}`}
            role="tab"
            aria-selected={d.key === selectedDay}
            style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setSelectedDay(d.key)}
          >
            <div className="dl">{d.label.slice(0, 3)}</div>
            <div className="dn">{d.date}</div>
          </button>
        ))}
      </div>

      <div className="mb-pad" style={{ paddingTop: 14, paddingBottom: 24 }}>
        {isLoading ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>Chargement…</div>
        ) : (
          <>
            <div className="m-section-h">
              <h3>
                {selectedDayInfo?.label} {selectedDayInfo?.date} · {dayAppointments.length} rendez-vous
              </h3>
            </div>

            <div className="m-tl">
              {dayAppointments.length === 0 ? (
                <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
                  Aucun rendez-vous ce jour.
                </div>
              ) : (
                dayAppointments.map((r, i) => (
                  <div key={i} className="m-tl-row">
                    <div className="m-tl-hour">{r.start}</div>
                    <div className="m-tl-col filled">
                      <div className={`m-tl-block ${r.status}`}>
                        <div className="m-tl-block-h">
                          <span className="m-tl-block-time">
                            {r.start} · {r.dur} min
                          </span>
                          <span className={`m-pill ${r.status}`} style={{ marginLeft: 'auto' }}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </div>
                        <div className="m-tl-block-name">{r.patient}</div>
                        <div className="m-tl-block-reason">{r.reason}</div>
                        {r.allergy && (
                          <div className="m-pill allergy" style={{ marginTop: 8 }}>
                            <Warn /> {r.allergy}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </MScreen>
  );
}
