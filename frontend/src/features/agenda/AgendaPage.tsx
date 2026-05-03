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
import { AgendaGrid } from './components/AgendaGrid';
import { TodayArrivals } from './components/TodayArrivals';
import { useWeekAppointments } from './hooks/useAppointments';
import { PriseRDVDialog } from '../prise-rdv/PriseRDVDialog';
import type { Appointment } from './types';
import './agenda.css';

export default function AgendaPage() {
  const navigate = useNavigate();
  const { days, appointments, arrivals } = useWeekAppointments();
  const [, setSelected] = useState<Appointment | null>(null);
  const [showRDV, setShowRDV] = useState(false);

  return (
    <>
    <Screen
      active="agenda"
      title="Agenda"
      sub="Semaine 17 · Avr 2026"
      pageDate="Jeudi 23 avril 2026 · 09:47"
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
      <AgendaToolbar />
      <AgendaGrid days={days} appointments={appointments} onSelect={setSelected} />
    </Screen>
    {showRDV && <PriseRDVDialog open={showRDV} onOpenChange={setShowRDV} />}
    </>
  );
}
