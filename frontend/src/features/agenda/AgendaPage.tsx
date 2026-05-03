/**
 * Screen 01 — Agenda semaine (desktop).
 * Ported from design/prototype/screens/agenda.jsx.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Phone, Plus } from '@/components/icons';
import { AgendaToolbar } from './components/AgendaToolbar';
import type { AgendaView } from './components/AgendaToolbar';
import { AgendaGrid } from './components/AgendaGrid';
import { TodayArrivals } from './components/TodayArrivals';
import { useWeekAppointments } from './hooks/useAppointments';
import { PriseRDVDialog } from '../prise-rdv/PriseRDVDialog';
import { AppointmentDrawer } from './components/AppointmentDrawer';
import type { Appointment, DayKey } from './types';
import './agenda.css';

const DAY_KEYS: DayKey[] = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

function currentDayKey(): DayKey {
  const dow = new Date().getDay();
  return dow === 0 ? 'lun' : (DAY_KEYS[dow - 1] ?? 'lun');
}

export default function AgendaPage() {
  const navigate = useNavigate();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<AgendaView>('semaine');
  const [selectedDay, setSelectedDay] = useState<DayKey>(currentDayKey);
  const { days, appointments, arrivals, weekLabel, todayKey, refetch } = useWeekAppointments(weekOffset);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showRDV, setShowRDV] = useState(false);

  const visibleDays = view === 'jour' ? days.filter((d) => d.key === selectedDay) : days;

  return (
    <>
    <Screen
      active="agenda"
      title="Agenda"
      sub={weekLabel}
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
        onViewChange={(v) => { setView(v); if (v === 'jour' && !selectedDay) setSelectedDay(currentDayKey()); }}
        weekLabel={weekLabel}
        onPrev={() => view === 'jour' ? setSelectedDay((k) => { const i = DAY_KEYS.indexOf(k); return i > 0 ? (DAY_KEYS[i - 1] ?? k) : (setWeekOffset((o) => o - 1), DAY_KEYS[DAY_KEYS.length - 1] ?? k); }) : setWeekOffset((o) => o - 1)}
        onNext={() => view === 'jour' ? setSelectedDay((k) => { const i = DAY_KEYS.indexOf(k); return i < DAY_KEYS.length - 1 ? (DAY_KEYS[i + 1] ?? k) : (setWeekOffset((o) => o + 1), DAY_KEYS[0] ?? k); }) : setWeekOffset((o) => o + 1)}
        onToday={() => { setWeekOffset(0); setSelectedDay(currentDayKey()); }}
        selectedDay={selectedDay}
        days={days}
        onDayChange={setSelectedDay}
      />
      <AgendaGrid days={visibleDays} appointments={appointments} onSelect={setSelected} {...(todayKey ? { today: todayKey } : {})} />
    </Screen>
    {showRDV && (
      <PriseRDVDialog
        open={showRDV}
        onOpenChange={setShowRDV}
        onCreated={() => { setWeekOffset(0); void refetch(); }}
      />
    )}
    <AppointmentDrawer
      open={!!selected}
      appointment={selected}
      onOpenChange={(o) => { if (!o) setSelected(null); }}
      onChanged={() => { void refetch(); }}
    />
    </>
  );
}
