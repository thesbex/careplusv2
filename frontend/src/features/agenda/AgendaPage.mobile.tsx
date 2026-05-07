/**
 * M01 — Agenda mobile (single-day timeline with a horizontal day-tab strip).
 * Ported from design/prototype/mobile/screens.jsx:MAgenda.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Plus, Warn } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import {
  ALL_PRACTITIONERS,
  type PractitionerIdFilter,
  useWeekAppointments,
} from './hooks/useAppointments';
import { usePractitioners } from './hooks/usePractitioners';
import { useRooms } from './hooks/useRooms';
import type { DayKey } from './types';

const PRACTITIONER_FILTER_KEY = 'agenda.practitionerFilter';

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
  const [weekOffset, setWeekOffset] = useState(0);

  // Multi-doctor + room (Wave 1, 2026-05-07).
  const currentUser = useAuthStore((s) => s.user);
  const { data: practitioners } = usePractitioners();
  const { data: rooms } = useRooms();
  const activePractitioners = useMemo(
    () => practitioners.filter((p) => p.active),
    [practitioners],
  );
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const showPractitionerSelector = activePractitioners.length >= 2;
  const showRoomSelector = activeRooms.length >= 2;

  const userRoles = currentUser?.roles ?? [];
  const isMedecin = userRoles.includes('MEDECIN');
  const defaultPractitionerFilter: PractitionerIdFilter =
    isMedecin && currentUser?.id ? currentUser.id : ALL_PRACTITIONERS;

  const [practitionerFilter, setPractitionerFilter] =
    useState<PractitionerIdFilter>(() => {
      try {
        const saved = localStorage.getItem(PRACTITIONER_FILTER_KEY);
        if (saved && saved !== ALL_PRACTITIONERS) return saved;
      } catch {
        // ignore
      }
      return defaultPractitionerFilter;
    });

  useEffect(() => {
    if (!currentUser) return;
    setPractitionerFilter((prev) => {
      try {
        const saved = localStorage.getItem(PRACTITIONER_FILTER_KEY);
        if (saved && saved !== ALL_PRACTITIONERS) return saved;
      } catch {
        // ignore
      }
      return prev === ALL_PRACTITIONERS ? defaultPractitionerFilter : prev;
    });
  }, [currentUser, defaultPractitionerFilter]);

  function changePractitionerFilter(next: PractitionerIdFilter): void {
    setPractitionerFilter(next);
    try {
      if (next === ALL_PRACTITIONERS) {
        localStorage.removeItem(PRACTITIONER_FILTER_KEY);
      } else {
        localStorage.setItem(PRACTITIONER_FILTER_KEY, next);
      }
    } catch {
      // ignore
    }
  }

  const [roomFilter, setRoomFilter] = useState<string>('ALL');

  const { days, appointments: rawAppointments, weekLabel, isLoading } = useWeekAppointments(
    weekOffset,
    { practitionerIdFilter: practitionerFilter },
  );
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey);

  const filteredAppointments = useMemo(
    () =>
      roomFilter === 'ALL'
        ? rawAppointments
        : rawAppointments.filter((a) => a.roomId === roomFilter),
    [rawAppointments, roomFilter],
  );
  const dayAppointments = filteredAppointments.filter((a) => a.day === selectedDay);
  const selectedDayInfo = days.find((d) => d.key === selectedDay);

  return (
    <MScreen
      tab="agenda"
      topbar={<MTopbar brand />}
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
      {/* Week navigation strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setWeekOffset((o) => o - 1)}
          aria-label="Semaine précédente"
          style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '6px 10px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            color: 'var(--ink-2)',
            fontSize: 12,
          }}
        >
          ‹ Préc.
        </button>
        <div
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--ink-2)',
          }}
        >
          {weekLabel}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {weekOffset !== 0 && (
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '6px 10px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: 'var(--primary)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Auj.
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label="Semaine suivante"
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '6px 10px',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--ink-2)',
              fontSize: 12,
            }}
          >
            Suiv. ›
          </button>
        </div>
      </div>

      {(showPractitionerSelector || showRoomSelector) && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {showPractitionerSelector && (
            <select
              aria-label="Filtrer par médecin"
              value={practitionerFilter}
              onChange={(e) =>
                changePractitionerFilter(e.target.value as PractitionerIdFilter)
              }
              style={{
                flex: 1,
                minWidth: 0,
                height: 32,
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0 8px',
                fontSize: 12.5,
                fontFamily: 'inherit',
                background: 'var(--surface)',
              }}
            >
              <option value={ALL_PRACTITIONERS}>Tous les médecins</option>
              {activePractitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  Dr {p.lastName} {p.firstName}
                </option>
              ))}
            </select>
          )}
          {showRoomSelector && (
            <select
              aria-label="Filtrer par salle"
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                height: 32,
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '0 8px',
                fontSize: 12.5,
                fontFamily: 'inherit',
                background: 'var(--surface)',
              }}
            >
              <option value="ALL">Toutes les salles</option>
              {activeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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
                  <div key={r.id ?? i} className="m-tl-row">
                    <div className="m-tl-hour">{r.start}</div>
                    <div className="m-tl-col filled">
                      <button
                        type="button"
                        className={`m-tl-block ${r.status}`}
                        onClick={() => {
                          if (r.patientId) navigate(`/patients/${r.patientId}`);
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          font: 'inherit',
                          fontFamily: 'inherit',
                          color: 'inherit',
                          cursor: r.patientId ? 'pointer' : 'default',
                          WebkitTapHighlightColor: 'transparent',
                        }}
                        aria-label={`Ouvrir le dossier de ${r.patient}`}
                      >
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
                      </button>
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
