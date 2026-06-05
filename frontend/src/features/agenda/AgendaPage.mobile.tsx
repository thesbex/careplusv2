/**
 * M01 — Agenda mobile (single-day timeline with a horizontal day-tab strip).
 * Ported from design/prototype/mobile/screens.jsx:MAgenda.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Plus, Warn, ChevronRight } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { useT } from '@/lib/i18n/I18nProvider';
import { useSpotlight } from '@/components/shell/spotlightContext';
import { toMin } from './fixtures';
import {
  ALL_PRACTITIONERS,
  type PractitionerIdFilter,
  useWeekAppointments,
} from './hooks/useAppointments';
import { usePractitioners } from './hooks/usePractitioners';
import { useRooms } from './hooks/useRooms';
import { useReasonsForAgenda } from './hooks/useReasonsForAgenda';
import type { DayKey } from './types';
// Mobile override « en cours » saphir + bandeau corail vivent dans agenda.css
// (block AGENDA MOBILE en bas). Import nécessaire car ce composant peut être
// rendu seul sans avoir chargé la version desktop.
import { Select } from '@/components/ui/Input';
import './agenda.css';

const PRACTITIONER_FILTER_KEY = 'agenda.practitionerFilter';

const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

function todayKey(): DayKey {
  const dow = new Date().getDay(); // 0=Sun
  return dow === 0 ? 'dim' : (DAY_KEYS[dow - 1] ?? 'lun');
}

const STATUS_KEY: Record<string, string> = {
  confirmed: 'agenda.mobile.status.confirmed',
  arrived: 'agenda.mobile.status.arrived',
  vitals: 'agenda.mobile.status.vitals',
  consult: 'agenda.mobile.status.consult',
  done: 'agenda.mobile.status.done',
};

const MONTHS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];

export default function AgendaMobilePage() {
  const navigate = useNavigate();
  const { t } = useT();
  const { openSpotlight } = useSpotlight();
  const [weekOffset, setWeekOffset] = useState(0);
  // Iso maquette mobile : le rail filtres est caché par défaut, révélé par
  // l'icône « Filter » de la topbar. Si l'utilisateur a un filtre actif
  // (médecin/salle/motif ≠ défaut), on le laisse visible quoi qu'il arrive
  // pour pas planquer une sélection en cours.
  const [showFilters, setShowFilters] = useState(false);

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
  // R052 — filtre motif de prestation (idem desktop).
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const { reasons, byId: reasonsById } = useReasonsForAgenda();

  const { days, appointments: rawAppointments, weekLabel, isLoading } = useWeekAppointments(
    weekOffset,
    { practitionerIdFilter: practitionerFilter },
  );
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey);

  const filteredAppointments = useMemo(
    () => {
      let out = rawAppointments;
      if (roomFilter !== 'ALL') out = out.filter((a) => a.roomId === roomFilter);
      if (reasonFilter !== 'ALL') out = out.filter((a) => a.reasonId === reasonFilter);
      return out;
    },
    [rawAppointments, roomFilter, reasonFilter],
  );
  const dayAppointments = filteredAppointments.filter((a) => a.day === selectedDay);
  // Count "en cours" for the stats line ("N RDV · M en cours") per maquette.
  const inProgressCount = dayAppointments.filter((a) => a.status === 'consult').length;

  // « En retard » dérivé pour le jour courant (mirror desktop : PLANIFIE/CONFIRME
  // dont le créneau a passé 5 min sans arrivée enregistrée). Calculé une fois ;
  // refresh à chaque re-render du composant (suffisant pour cet usage).
  const nowMinutes = (() => {
    const d = new Date();
    return (d.getHours() - 8) * 60 + d.getMinutes();
  })();
  const isLateMobile = (a: { start: string; status: string }) =>
    a.status === 'confirmed' && selectedDay === todayKey() && toMin(a.start) + 5 < nowMinutes;

  // Iso maquette sub : « <Jour> <date> <mois> » (ex. « Jeudi 28 mai »).
  // Calculée à partir du jour sélectionné du strip, pas du jour réel — quand
  // l'utilisateur scrolle la semaine, le sub doit suivre.
  const subDate = (() => {
    const now = new Date();
    const dow = now.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const idx = DAY_KEYS.indexOf(selectedDay);
    const d = new Date(monday);
    d.setDate(monday.getDate() + (idx === -1 ? 0 : idx));
    const wkLabel = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    return wkLabel.charAt(0).toUpperCase() + wkLabel.slice(1);
  })();

  // True si l'utilisateur a un filtre actif (autre que la valeur par défaut).
  // Dans ce cas on garde le rail filtres visible quoi qu'il arrive — planquer
  // une sélection active derrière l'icône topbar serait piégeux.
  const hasActiveFilter =
    practitionerFilter !== defaultPractitionerFilter ||
    roomFilter !== 'ALL' ||
    reasonFilter !== 'ALL';
  const filtersVisible = showFilters || hasActiveFilter;
  // Eviter "unused variable" — MONTHS_FR sera utile pour la sous-ligne mois
  // si on stabilise une autre formulation plus tard.
  void MONTHS_FR;

  return (
    <MScreen
      tab="agenda"
      topbar={
        <MTopbar
          title={t('nav.agenda')}
          sub={subDate}
          right={
            <>
              <MIconBtn
                icon="Filter"
                label={filtersVisible ? t('agenda.mobile.hideFilters') : t('agenda.mobile.showFilters')}
                onClick={() => setShowFilters((v) => !v)}
              />
              <MIconBtn icon="Search" label={t('agenda.mobile.searchPatient')} onClick={openSpotlight} />
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
          aria-label={t('agenda.newRdv')}
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
          aria-label={t('agenda.mobile.prevWeek')}
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
          {t('agenda.mobile.prevShort')}
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
              {t('agenda.mobile.todayShort')}
            </button>
          )}
          <button
            type="button"
            onClick={() => setWeekOffset((o) => o + 1)}
            aria-label={t('agenda.mobile.nextWeek')}
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
            {t('agenda.mobile.nextShort')}
          </button>
        </div>
      </div>

      {filtersVisible && (showPractitionerSelector || showRoomSelector || reasons.length > 0) && (
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
            <Select
              aria-label={t('agenda.filter.doctorAria')}
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
              <option value={ALL_PRACTITIONERS}>{t('agenda.filter.allDoctors')}</option>
              {activePractitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  Dr {p.lastName} {p.firstName}
                </option>
              ))}
            </Select>
          )}
          {showRoomSelector && (
            <Select
              aria-label={t('agenda.filter.roomAria')}
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
              <option value="ALL">{t('agenda.filter.allRooms')}</option>
              {activeRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          )}
          {reasons.length > 0 && (
            <Select
              aria-label={t('agenda.filter.reasonAria')}
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
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
              <option value="ALL">{t('agenda.filter.allReasons')}</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
          )}
        </div>
      )}

      <div className="m-daytabs" role="tablist" aria-label={t('agenda.mobile.dayTablistAria')}>
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            className={`m-daytab ${d.key === selectedDay ? 'on' : ''}`}
            role="tab"
            aria-selected={d.key === selectedDay}
            // a11y : 1 lettre côté visuel (iso maquette) mais nom complet
            // côté lecteur d'écran + tests (« Lundi 25 », pas « L 25 »).
            aria-label={`${d.label} ${d.date}`}
            style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}
            onClick={() => setSelectedDay(d.key)}
          >
            {/* Iso maquette : label sur 1 lettre (L, M, M, J, V, S). */}
            <div className="dl" aria-hidden="true">{d.label.charAt(0)}</div>
            <div className="dn" aria-hidden="true">{d.date}</div>
          </button>
        ))}
      </div>

      <div className="mb-pad" style={{ paddingTop: 14, paddingBottom: 24 }}>
        {isLoading ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>{t('common.loading')}</div>
        ) : (
          <>
            {/* Iso maquette mobile : « N RDV · M en cours » + « Voir tout » lien
                aligné à droite vers la salle d'attente. Affiché uniquement si
                M > 0 — sinon "Voir tout" pointe nulle part d'utile. */}
            <div className="m-section-h">
              <h3 className="tnum">
                {t('agenda.mobile.rdvCount', { n: dayAppointments.length })}
                {inProgressCount > 0 && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--ds2-navy, var(--primary))', fontWeight: 600 }}>
                      {t('agenda.mobile.inProgress', { n: inProgressCount })}
                    </span>
                  </>
                )}
              </h3>
              {inProgressCount > 0 && (
                <button
                  type="button"
                  className="more"
                  onClick={() => navigate('/salle')}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    fontFamily: 'inherit',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--ds2-navy, var(--primary))',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                  aria-label={t('agenda.mobile.seeAllAria')}
                >
                  {t('agenda.mobile.seeAll')}
                  <ChevronRight />
                </button>
              )}
            </div>

            <div className="m-tl">
              {dayAppointments.length === 0 ? (
                <div style={{ color: 'var(--ink-3)', fontSize: 13, padding: '12px 0' }}>
                  {t('agenda.mobile.noRdvToday')}
                </div>
              ) : (
                dayAppointments.map((r, i) => {
                  const reasonColor = r.reasonId ? reasonsById[r.reasonId]?.colorHex : undefined;
                  return (
                  <div key={r.id ?? i} className="m-tl-row">
                    <div className="m-tl-hour">{r.start}</div>
                    <div className="m-tl-col filled">
                      <button
                        type="button"
                        className={`m-tl-block ${r.status}${isLateMobile(r) ? ' late' : ''}`}
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
                          // R053 — bordure gauche teintée selon le motif de prestation
                          // (control / urgence / certificat…), en surplus du fond
                          // qui code le statut (consult / arrived / done).
                          ...(reasonColor ? { borderLeft: `3px solid ${reasonColor}` } : {}),
                        }}
                        aria-label={t('agenda.mobile.openDossierAria', { patient: r.patient })}
                      >
                        <div className="m-tl-block-h">
                          <span className="m-tl-block-time">
                            {r.start} · {r.dur} min
                          </span>
                          <span className={`m-pill ${isLateMobile(r) ? 'late' : r.status}`} style={{ marginLeft: 'auto' }}>
                            {isLateMobile(r) ? t('agenda.status.late') : (STATUS_KEY[r.status] ? t(STATUS_KEY[r.status]!) : r.status)}
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
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </MScreen>
  );
}
