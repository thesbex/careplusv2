/**
 * Screen 01 — Agenda semaine / mois / jour (desktop).
 * Ported from design/prototype/screens/agenda.jsx, extended with month view
 * and practitioner-leave overlay.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Phone, Plus } from '@/components/icons';
import { AgendaToolbar } from './components/AgendaToolbar';
import type { AgendaView } from './components/AgendaToolbar';
import { AgendaGrid } from './components/AgendaGrid';
import { MonthGrid } from './components/MonthGrid';
import { TodayArrivals } from './components/TodayArrivals';
import { useWeekAppointments, useMonthAppointments } from './hooks/useAppointments';
import { useLeaves } from '@/features/parametres/hooks/useLeaves';
import { PriseRDVDialog } from '../prise-rdv/PriseRDVDialog';
import { AppointmentDrawer } from './components/AppointmentDrawer';
import type { Appointment, DayKey } from './types';
import './agenda.css';

const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
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

export default function AgendaPage() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<AgendaView>('semaine');
  const [selectedDay, setSelectedDay] = useState<DayKey>(currentDayKey);
  const { days, appointments, arrivals, weekLabel, todayKey, refetch } = useWeekAppointments(weekOffset);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showRDV, setShowRDV] = useState(false);

  // Month view state — independent of weekOffset.
  const todayDate = new Date();
  const [monthYear, setMonthYear] = useState(todayDate.getFullYear());
  const [monthIndex, setMonthIndex] = useState(todayDate.getMonth());
  const monthLabel = `${MONTHS_FR[monthIndex] ?? ''} ${monthYear}`;
  const { appointments: monthAppointments } = useMonthAppointments(monthYear, monthIndex);

  // Leaves cover all views; the month grid + week/day overlay both consume them.
  const { leaves } = useLeaves();

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
  const headerLabel = view === 'mois' ? monthLabel : weekLabel;

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
        topbarRight={
          <>
            <Button>
              <Phone /> Appel rapide
            </Button>
            <Button variant="primary" onClick={() => setShowRDV(true)}>
              <Plus /> Nouveau RDV
            </Button>
          </>
        }
        right={<TodayArrivals arrivals={arrivals} />}
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
          selectedDay={selectedDay}
          days={days}
          onDayChange={setSelectedDay}
        />
        {view === 'mois' ? (
          <MonthGrid
            year={monthYear}
            month={monthIndex}
            appointments={monthAppointments}
            leaves={leaves}
            onSelectDay={handleMonthDayClick}
          />
        ) : (
          <AgendaGrid
            days={visibleDays}
            appointments={appointments}
            onSelect={setSelected}
            leaveDays={leaveDays}
            {...(todayKey ? { today: todayKey } : {})}
          />
        )}
      </Screen>
      {showRDV && (
        <PriseRDVDialog
          open={showRDV}
          onOpenChange={setShowRDV}
          onCreated={() => {
            setWeekOffset(0);
            void refetch();
          }}
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
