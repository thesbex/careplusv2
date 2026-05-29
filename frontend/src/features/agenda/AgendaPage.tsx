/**
 * Screen 01 — Agenda semaine / mois / jour (desktop).
 * Ported from design/prototype/screens/agenda.jsx, extended with month view
 * and practitioner-leave overlay.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Plus } from '@/components/icons';
import { useAuthStore } from '@/lib/auth/authStore';
import { AgendaToolbar } from './components/AgendaToolbar';
import type { AgendaView } from './components/AgendaToolbar';
import { AgendaGrid } from './components/AgendaGrid';
import { MonthGrid } from './components/MonthGrid';
import { MonthSidebar } from './components/MonthSidebar';
import { TodayArrivals } from './components/TodayArrivals';
import {
  ALL_PRACTITIONERS,
  type PractitionerIdFilter,
  useMonthAppointments,
  useWeekAppointments,
} from './hooks/useAppointments';
import { useMoveAppointment, extractConflictMessage } from './hooks/useAppointmentMutations';
import { usePractitioners } from './hooks/usePractitioners';
import { useLunchBreak } from './hooks/useLunchBreak';
import { useRooms } from './hooks/useRooms';
import { useReasonsForAgenda } from './hooks/useReasonsForAgenda';
import { useLeaves } from '@/features/parametres/hooks/useLeaves';
import { useQueue } from '@/features/salle-attente/hooks/useQueue';
import { PriseRDVDialog } from '../prise-rdv/PriseRDVDialog';
import { AppointmentDrawer } from './components/AppointmentDrawer';
import { toast } from 'sonner';
import type { Appointment, Arrival, DayKey } from './types';
import './agenda.css';

const PRACTITIONER_FILTER_KEY = 'agenda.practitionerFilter';

const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

/**
 * Pause déjeuner configurable par jour — user 2026-05-28 a explicitement
 * demandé que ce ne soit PAS figé pour tous les jours. Heuristique Maroc :
 * Lun-Ven 12:00-14:00 ; samedi pas de pause (cabinet ferme tôt l'après-midi).
 *
 * À déplacer dans une table `cabinet_lunch_break` (jour → start/end) côté
 * backend quand le module Paramètres → Horaires sera prêt. La constante
 * suivante est un placeholder local en attendant.
 */
const DEFAULT_LUNCH_BREAKS: Partial<Record<DayKey, { start: string; end: string }>> = {
  lun: { start: '12:00', end: '14:00' },
  mar: { start: '12:00', end: '14:00' },
  mer: { start: '12:00', end: '14:00' },
  jeu: { start: '12:00', end: '14:00' },
  ven: { start: '12:00', end: '14:00' },
  // sam: pas de pause par défaut.
};
const MONTHS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];

function currentDayKey(): DayKey {
  const dow = new Date().getDay();
  return dow === 0 ? 'lun' : (DAY_KEYS[dow - 1] ?? 'lun');
}

function isoOfDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatPageDate(d: Date): string {
  const dateFmt = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dateFmt.charAt(0).toUpperCase()}${dateFmt.slice(1)} · ${time}`;
}

export default function AgendaPage() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<AgendaView>('semaine');
  const [selectedDay, setSelectedDay] = useState<DayKey>(currentDayKey);
  const pageDate = formatPageDate(new Date());

  // ── Multi-doctor + room selectors (Wave 1, 2026-05-07) ──────────────
  const currentUser = useAuthStore((s) => s.user);
  const { data: practitioners } = usePractitioners();
  const { data: rooms } = useRooms();
  const activePractitioners = useMemo(
    () => practitioners.filter((p) => p.active),
    [practitioners],
  );
  // Palette stable par ordre d'apparition (saphir, vert, ambre, corail, indigo).
  // Source de vérité unique pour : pastille colonne lane (multi-doc Jour),
  // mini-avatar carte RDV (Semaine multi-doc), pastille bandeau légende bas.
  const DOCTOR_PALETTE = ['#1E4DAB', '#2F8F6B', '#C68A2E', '#C2553A', '#5A4FCF'];
  const practitionerMap = useMemo(() => {
    const m: Record<string, { initials: string; color: string; name: string }> = {};
    activePractitioners.forEach((p, i) => {
      // Initiales = première lettre du prénom + première lettre du nom
      // (« Youssef El Amrani » → « YE »). En l'absence de prénom ou de nom,
      // on retombe sur les 2 premières lettres du nom dispo.
      const fn = (p.firstName || '').trim();
      const ln = (p.lastName || '').trim();
      const initials = ((fn[0] ?? ln[0] ?? '?') + (ln[0] ?? fn[1] ?? '')).toUpperCase();
      m[p.id] = {
        initials,
        color: DOCTOR_PALETTE[i % DOCTOR_PALETTE.length] ?? '#1E4DAB',
        name: `Dr ${ln} ${fn}`.trim(),
      };
    });
    return m;
  }, [activePractitioners]);
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);
  const showPractitionerSelector = activePractitioners.length >= 2;
  const showRoomSelector = activeRooms.length >= 2;

  // Default per role: MEDECIN → self; SECRETAIRE/ASSISTANT/ADMIN → ALL.
  const userRoles = currentUser?.roles ?? [];
  const isMedecin = userRoles.includes('MEDECIN');
  const defaultPractitionerFilter: PractitionerIdFilter =
    isMedecin && currentUser?.id ? currentUser.id : ALL_PRACTITIONERS;

  // Read persisted choice on mount (skipping ALL — ALL stays the default
  // for non-MEDECIN roles even if previously chosen).
  const [practitionerFilter, setPractitionerFilter] =
    useState<PractitionerIdFilter>(() => {
      try {
        const saved = localStorage.getItem(PRACTITIONER_FILTER_KEY);
        if (saved && saved !== ALL_PRACTITIONERS) return saved;
      } catch {
        // localStorage may be unavailable (private mode, SSR) — ignore.
      }
      return defaultPractitionerFilter;
    });

  // Re-sync once the user object is hydrated post-bootstrap.
  useEffect(() => {
    if (!currentUser) return;
    setPractitionerFilter((prev) => {
      // Keep an explicit per-doctor selection across reloads. Only fall
      // back to the role-based default when nothing was persisted.
      try {
        const saved = localStorage.getItem(PRACTITIONER_FILTER_KEY);
        if (saved && saved !== ALL_PRACTITIONERS) return saved;
      } catch {
        // ignore
      }
      return prev === ALL_PRACTITIONERS ? defaultPractitionerFilter : prev;
    });
  }, [currentUser, defaultPractitionerFilter]);

  // Persist explicit selections; clear on ALL.
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

  const [roomFilter, setRoomFilter] = useState<string>('ALL'); // 'ALL' | roomId
  // R052 — filtre par motif de prestation (control, première visite, urgence…).
  const [reasonFilter, setReasonFilter] = useState<string>('ALL'); // 'ALL' | reasonId
  const { reasons, byId: reasonsById } = useReasonsForAgenda();

  const { days, appointments: rawAppointments, weekLabel, todayKey, refetch } =
    useWeekAppointments(weekOffset, { practitionerIdFilter: practitionerFilter });

  // Real waiting-room queue (arrived/vitals/consult only — those are the
  // statuses the right-panel "Arrivées du jour" cards render). Reflects today,
  // regardless of which day/week the user is browsing in the agenda.
  const { queue } = useQueue();
  const arrivals = useMemo<Arrival[]>(
    () =>
      queue
        .filter(
          (e): e is typeof e & { status: 'arrived' | 'vitals' | 'consult' } =>
            e.status === 'arrived' || e.status === 'vitals' || e.status === 'consult',
        )
        .map((e) => {
          const a: Arrival = {
            name: e.name,
            apt: e.apt,
            status: e.status,
            since: e.arrived,
          };
          if (e.allergy) a.allergy = e.allergy;
          if (e.practitionerId) a.practitionerId = e.practitionerId;
          return a;
        }),
    [queue],
  );

  // Client-side filters (rooms + reasons come from the appointment payload).
  const appointments = useMemo(
    () => {
      let out = rawAppointments;
      if (roomFilter !== 'ALL') out = out.filter((a) => a.roomId === roomFilter);
      if (reasonFilter !== 'ALL') out = out.filter((a) => a.reasonId === reasonFilter);
      return out;
    },
    [rawAppointments, roomFilter, reasonFilter],
  );

  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showRDV, setShowRDV] = useState(false);
  const [rdvPrefill, setRdvPrefill] = useState<{ date: string; time: string } | null>(null);
  // QA3-3 v1: hide the create-RDV CTA when the role doesn't grant the
  // permission. Backward-compat: if `permissions` is undefined (legacy
  // session before /users/me started returning the field), treat as allowed.
  const userPerms = useAuthStore((s) => s.user?.permissions);
  const canCreateRdv = userPerms == null || userPerms.includes('APPOINTMENT_CREATE');
  const { moveAppointment } = useMoveAppointment();

  // Month view state — independent of weekOffset.
  const todayDate = new Date();
  const [monthYear, setMonthYear] = useState(todayDate.getFullYear());
  const [monthIndex, setMonthIndex] = useState(todayDate.getMonth());
  const monthLabel = `${MONTHS_FR[monthIndex] ?? ''} ${monthYear}`;
  const { appointments: rawMonthAppointments } = useMonthAppointments(monthYear, monthIndex, {
    practitionerIdFilter: practitionerFilter,
  });

  // Apply the same Salle + Motif filters to the month view that the week/day
  // view gets (lignes 154-162). Without this, selecting a motif in Mois did
  // nothing — MonthGrid/MonthSidebar/count all consumed the raw payload.
  const monthAppointments = useMemo(() => {
    let out = rawMonthAppointments;
    if (roomFilter !== 'ALL') out = out.filter((a) => a.roomId === roomFilter);
    if (reasonFilter !== 'ALL') out = out.filter((a) => a.reasonId === reasonFilter);
    return out;
  }, [rawMonthAppointments, roomFilter, reasonFilter]);

  // Leaves cover all views; the month grid + week/day overlay both consume them.
  // Multi-praticien : si l'utilisateur a sélectionné UN médecin précis dans le
  // filtre, on charge ses congés à lui plutôt que ceux du user connecté. En
  // mode "Tous les médecins" (ALL_PRACTITIONERS) on retombe sur les congés du
  // user connecté — agréger N agendas n'aurait pas de sens visuel et marquer
  // un jour "Congé" sur l'overlay alors qu'un autre médecin travaille
  // tromperait la secrétaire.
  const leavePractitionerId =
    practitionerFilter === ALL_PRACTITIONERS ? undefined : practitionerFilter;
  const { leaves } = useLeaves(leavePractitionerId);

  // V067 — pause déjeuner du médecin sélectionné (sinon défaut cabinet 12–14h).
  const { lunchBreak } = useLunchBreak(leavePractitionerId);
  const lunchBreaks = useMemo<Partial<Record<DayKey, { start: string; end: string }>>>(() => {
    if (!lunchBreak) return DEFAULT_LUNCH_BREAKS;
    const w = { start: lunchBreak.startTime.slice(0, 5), end: lunchBreak.endTime.slice(0, 5) };
    return { lun: w, mar: w, mer: w, jeu: w, ven: w };
  }, [lunchBreak]);

  // Map week's days -> Set<DayKey> currently in a leave range.
  const leaveDays = useMemo(() => {
    const set = new Set<DayKey>();
    if (todayKey === null) return set; // not the current week, leave overlay only paints today's week for now
    // Compute Monday of the displayed week
    const now = new Date();
    const dow = now.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    DAY_KEYS.forEach((k, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = isoOfDate(d);
      if (leaves.some((l) => iso >= l.startDate && iso <= l.endDate)) {
        set.add(k);
      }
    });
    return set;
  }, [leaves, weekOffset, todayKey]);

  const visibleDays = view === 'jour' ? days.filter((d) => d.key === selectedDay) : days;

  // Today's RDV count — used as the right-panel total ("X autres RDV
  // attendus aujourd'hui"). When the displayed week doesn't contain today
  // (offset != 0, or weekend), `todayKey` is null and we fall back to 0
  // since the message literally says "aujourd'hui".
  const todayRdvCount = useMemo(() => {
    if (todayKey === null) return 0;
    return appointments.filter((a) => a.day === todayKey).length;
  }, [appointments, todayKey]);

  // For Jour view we surface a friendly "Jeudi 23 avril 2026" label in the
  // toolbar (per design-handoff-v2 / `screens/agenda.jsx::AgendaJourScreen`,
  // `sub="Jeudi 23 avril 2026"`) — the RDV count lives inside the day header
  // cell as "X RDV programmés" and isn't duplicated here. Format from the
  // real Date so weeks that span two months ("27 avr. – 2 mai") still
  // produce a single-month label per day.
  const jourLabel = (() => {
    if (view !== 'jour') return null;
    const d = visibleDays[0];
    if (!d) return weekLabel;
    const iso = isoOfDayKey(d.key);
    const target = new Date(`${iso}T00:00:00`);
    const formatted = target.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  })();
  // Mois subtitle per maquette : "Avril 2026 · 142 rendez-vous".
  const moisLabel =
    view === 'mois'
      ? `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} · ${monthAppointments.length} rendez-vous`
      : monthLabel;
  const headerLabel = view === 'mois' ? moisLabel : view === 'jour' ? jourLabel ?? weekLabel : weekLabel;

  function handlePrev() {
    if (view === 'mois') {
      if (monthIndex === 0) {
        setMonthIndex(11);
        setMonthYear((y) => y - 1);
      } else {
        setMonthIndex((m) => m - 1);
      }
      return;
    }
    if (view === 'jour') {
      setSelectedDay((k) => {
        const i = DAY_KEYS.indexOf(k);
        if (i > 0) return DAY_KEYS[i - 1] ?? k;
        setWeekOffset((o) => o - 1);
        return DAY_KEYS[DAY_KEYS.length - 1] ?? k;
      });
      return;
    }
    setWeekOffset((o) => o - 1);
  }

  function handleNext() {
    if (view === 'mois') {
      if (monthIndex === 11) {
        setMonthIndex(0);
        setMonthYear((y) => y + 1);
      } else {
        setMonthIndex((m) => m + 1);
      }
      return;
    }
    if (view === 'jour') {
      setSelectedDay((k) => {
        const i = DAY_KEYS.indexOf(k);
        if (i < DAY_KEYS.length - 1) return DAY_KEYS[i + 1] ?? k;
        setWeekOffset((o) => o + 1);
        return DAY_KEYS[0] ?? k;
      });
      return;
    }
    setWeekOffset((o) => o + 1);
  }

  function isoOfDayKey(dayKey: DayKey): string {
    // Mirror leaveDays computation: find Monday of the displayed week, then add offset.
    const now = new Date();
    const dow = now.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    const idx = DAY_KEYS.indexOf(dayKey);
    const target = new Date(monday);
    target.setDate(monday.getDate() + (idx === -1 ? 0 : idx));
    return isoOfDate(target);
  }

  function handleSlotClick(dayKey: DayKey, time: string) {
    if (!canCreateRdv) return;
    setRdvPrefill({ date: isoOfDayKey(dayKey), time });
    setShowRDV(true);
  }

  async function handleDragMove(appointmentId: string, dayKey: DayKey, time: string) {
    if (!canCreateRdv) {
      toast.error("Vous n'avez pas les droits pour déplacer un rendez-vous.");
      return;
    }
    const apt = appointments.find((a) => a.id === appointmentId);
    if (!apt) return;
    // Build the new ISO timestamp from (target day, snapped time).
    const iso = isoOfDayKey(dayKey);
    const startAt = new Date(`${iso}T${time}:00`).toISOString();
    try {
      await moveAppointment({
        id: appointmentId,
        startAt,
        durationMinutes: apt.dur,
      });
      toast.success('Rendez-vous déplacé.');
      void refetch();
    } catch (err) {
      const conflict = extractConflictMessage(err);
      toast.error(conflict ?? 'Échec du déplacement du rendez-vous.');
    }
  }

  function handleMonthDayClick(iso: string) {
    // Switch to "jour" view with the selected day. Compute weekOffset so the
    // week containing that day is loaded, then snap selectedDay to its DayKey.
    const target = new Date(`${iso}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dowToday = today.getDay() === 0 ? 7 : today.getDay();
    const mondayThisWeek = new Date(today);
    mondayThisWeek.setDate(today.getDate() - (dowToday - 1));
    const diffDays = Math.round(
      (target.getTime() - mondayThisWeek.getTime()) / (24 * 60 * 60 * 1000),
    );
    const offset = Math.floor(diffDays / 7);
    setWeekOffset(offset);
    const dow = target.getDay();
    const idx = dow === 0 ? 6 : dow - 1;
    const key = DAY_KEYS[idx] ?? 'lun';
    setSelectedDay(key);
    setView('jour');
  }

  return (
    <>
      <Screen
        active="agenda"
        title="Agenda"
        sub={headerLabel}
        pageDate={pageDate}
        topbarRight={
          canCreateRdv ? (
            <Button
              className="cp-ds2-primary"
              onClick={() => {
                setRdvPrefill(null);
                setShowRDV(true);
              }}
            >
              <Plus /> Nouveau RDV
            </Button>
          ) : undefined
        }
        right={
          view === 'mois' ? (
            <MonthSidebar monthLabel={monthLabel} appointments={monthAppointments} />
          ) : (
            <TodayArrivals
              arrivals={arrivals}
              remaining={Math.max(0, todayRdvCount - arrivals.length)}
              {...(activePractitioners.length >= 2 ? { practitionerMap } : {})}
            />
          )
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
        <AgendaToolbar
          view={view}
          onViewChange={(v) => {
            setView(v);
            if (v === 'jour' && !selectedDay) setSelectedDay(currentDayKey());
            if (v === 'mois') {
              setMonthYear(new Date().getFullYear());
              setMonthIndex(new Date().getMonth());
            }
          }}
          weekLabel={headerLabel}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={() => {
            setWeekOffset(0);
            setSelectedDay(currentDayKey());
            setMonthYear(new Date().getFullYear());
            setMonthIndex(new Date().getMonth());
          }}
        />
        {(showPractitionerSelector || showRoomSelector || reasons.length > 0) && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              padding: '8px 16px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {showPractitionerSelector && (
              <label className="ag-filter-label">
                Médecin
                <Select
                  aria-label="Filtrer par médecin"
                  className="ag-filter-select"
                  value={practitionerFilter}
                  onChange={(e) =>
                    changePractitionerFilter(e.target.value as PractitionerIdFilter)
                  }
                >
                  <option value={ALL_PRACTITIONERS}>Tous les médecins</option>
                  {activePractitioners.map((p) => (
                    <option key={p.id} value={p.id}>
                      Dr {p.lastName} {p.firstName}
                      {p.specialty ? ` — ${p.specialty}` : ''}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {showRoomSelector && (
              <label className="ag-filter-label">
                Salle
                <Select
                  aria-label="Filtrer par salle"
                  className="ag-filter-select"
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                >
                  <option value="ALL">Toutes les salles</option>
                  {activeRooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {/* R052 — filtre par motif de prestation. Affiché même en cabinet
                solo (un médecin a souvent envie d'isoler ses urgences). */}
            {reasons.length > 0 && (
              <label className="ag-filter-label">
                Motif
                <Select
                  aria-label="Filtrer par motif de prestation"
                  className="ag-filter-select"
                  value={reasonFilter}
                  onChange={(e) => setReasonFilter(e.target.value)}
                >
                  <option value="ALL">Tous les motifs</option>
                  {reasons.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        )}
        {view === 'mois' ? (
          <MonthGrid
            year={monthYear}
            month={monthIndex}
            appointments={monthAppointments}
            leaves={leaves}
            onSelectDay={handleMonthDayClick}
          />
        ) : (
          <>
            <AgendaGrid
              days={visibleDays}
              appointments={appointments}
              onSelect={setSelected}
              onSlotClick={handleSlotClick}
              onMove={(id, dayKey, time) => void handleDragMove(id, dayKey, time)}
              leaveDays={leaveDays}
              jourMode={view === 'jour'}
              {...(todayKey ? { today: todayKey } : {})}
              reasonColors={Object.fromEntries(
                Object.entries(reasonsById).map(([id, r]) => [id, r.colorHex]),
              )}
              {...(view === 'jour' && practitionerFilter === ALL_PRACTITIONERS && activePractitioners.length >= 2
                ? {
                    doctorLanes: activePractitioners.map((p) => ({
                      id: p.id,
                      name: `Dr ${p.lastName}${p.specialty ? ` · ${p.specialty}` : ''}`,
                      // Couleur prise de la même palette que practitionerMap pour
                      // garder une cohérence visuelle entre pastille lane et avatar.
                      dotColor: practitionerMap[p.id]?.color ?? '#1E4DAB',
                    })),
                  }
                : {})}
              {...(activePractitioners.length >= 2 && Object.keys(practitionerMap).length > 0
                ? { practitionerMap }
                : {})}
              lunchBreaks={lunchBreaks}
            />
            {/* Bandeau légende bas (iso maquette user 2026-05-28) : visible en
                vue Semaine + multi-praticien. Liste Médecins (pastille couleur
                + nom) puis Statuts. La légende inline du toolbar reste pour
                les écrans single-doctor où la rangée médecin n'a pas de sens. */}
            {view === 'semaine' && activePractitioners.length >= 2 && (
              <div className="ag-week-legend" aria-label="Légende médecins et statuts">
                <div className="ag-week-legend-row">
                  <span className="ag-week-legend-title">Médecins</span>
                  {activePractitioners.map((p) => {
                    const meta = practitionerMap[p.id];
                    if (!meta) return null;
                    return (
                      <span key={p.id} className="ag-week-legend-item">
                        <span className="ag-week-legend-dot" style={{ background: meta.color }} />
                        {meta.name}
                      </span>
                    );
                  })}
                </div>
                <div className="ag-week-legend-row">
                  <span className="ag-week-legend-title">Statuts</span>
                  <span className="ag-week-legend-item"><i className="ag-leg-swatch" style={{ background: '#DCE5F5', borderLeftColor: 'var(--ds2-navy, #1E4DAB)' }} />Confirmé</span>
                  <span className="ag-week-legend-item"><i className="ag-leg-swatch" style={{ background: '#DEF0E6', borderLeftColor: '#2F8F6B' }} />Arrivé</span>
                  <span className="ag-week-legend-item"><i className="ag-leg-swatch" style={{ background: '#FBEFE3', borderLeftColor: '#C68A2E' }} />En attente</span>
                  <span className="ag-week-legend-item"><i className="ag-leg-swatch" style={{ background: 'var(--ds2-navy, #1E4DAB)', borderLeftColor: 'var(--ds2-navy, #1E4DAB)' }} />En cours</span>
                  <span className="ag-week-legend-item"><i className="ag-leg-swatch" style={{ background: '#DCE5F5', borderLeftColor: 'var(--ds2-coral, #C2553A)' }} />En retard</span>
                  <span className="ag-week-legend-item"><i className="ag-leg-swatch" style={{ background: '#F2F1EC', borderLeftColor: '#9B9B9B' }} />Terminé</span>
                </div>
              </div>
            )}
          </>
        )}
      </Screen>
      {showRDV && (
        <PriseRDVDialog
          open={showRDV}
          onOpenChange={(o) => {
            setShowRDV(o);
            if (!o) setRdvPrefill(null);
          }}
          onCreated={(createdDate) => {
            setRdvPrefill(null);
            // Navigate to the week (and month) that actually contains the new
            // RDV. Without this, a booking made for next week silently lands
            // off-screen and the user thinks creation failed.
            if (createdDate) {
              const target = new Date(`${createdDate}T00:00:00`);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const dowToday = today.getDay() === 0 ? 7 : today.getDay();
              const mondayThisWeek = new Date(today);
              mondayThisWeek.setDate(today.getDate() - (dowToday - 1));
              const diffDays = Math.round(
                (target.getTime() - mondayThisWeek.getTime()) / (24 * 60 * 60 * 1000),
              );
              setWeekOffset(Math.floor(diffDays / 7));
              setMonthYear(target.getFullYear());
              setMonthIndex(target.getMonth());
            }
            void refetch();
          }}
          {...(rdvPrefill ? { prefilledDate: rdvPrefill.date, prefilledTime: rdvPrefill.time } : {})}
        />
      )}
      <AppointmentDrawer
        open={!!selected}
        appointment={selected}
        onOpenChange={(o) => {
          if (!o) setSelected(null);
        }}
        onChanged={() => {
          void refetch();
        }}
      />
    </>
  );
}
