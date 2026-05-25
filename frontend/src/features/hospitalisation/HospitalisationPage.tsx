/**
 * Écran « Patients hospitalisés » (desktop) — worklist des séjours EN_COURS +
 * admission + transfert + sortie + facturation du séjour (Slice B+D).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/components/shell/Screen';
import { Button } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { AdmissionForm, StayDetailPanel } from './components/StayPanels';
import { useStayQueue, type StayQueueEntry } from './hooks/useStays';

const NAV_MAP = {
  dashboard: '/dashboard', agenda: '/agenda', patients: '/patients', salle: '/salle',
  consult: '/consultations', factu: '/facturation', vaccinations: '/vaccinations',
  grossesses: '/grossesses', stock: '/stock', queueLab: '/queue/lab', queueRadio: '/queue/radio',
  messages: '/messages', catalogue: '/catalogue', params: '/parametres', sejours: '/hospitalisation',
} as const;

function StayRow({ stay, onOpen }: { stay: StayQueueEntry; onOpen: () => void }) {
  return (
    <div data-testid={`stay-row-${stay.stayId}`} style={{ display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{stay.patientLastName} {stay.patientFirstName}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>
          {stay.bedLabel ?? '—'}{stay.wardLabel ? ` · ${stay.wardLabel}` : ''}
          {stay.admissionReason ? ` · ${stay.admissionReason}` : ''}
        </div>
      </div>
      <span style={{ fontSize: 11.5, padding: '2px 10px', borderRadius: 999, background: 'var(--bg-alt)', color: 'var(--ink-2)' }}>
        Jour {stay.daysSoFar}
      </span>
      <Button size="sm" variant="ghost" onClick={onOpen}>Gérer</Button>
    </div>
  );
}

export default function HospitalisationPage() {
  const navigate = useNavigate();
  const { stays, isLoading, error } = useStayQueue();
  const [admitting, setAdmitting] = useState(false);
  const [openStay, setOpenStay] = useState<string | null>(null);

  return (
    <Screen active="sejours" title="Hospitalisation" sub="Patients hospitalisés"
      onNavigate={(id) => navigate(NAV_MAP[id])}>
      <div style={{ padding: 24, overflow: 'auto', flex: 1 }} className="scroll">
        <div style={{ display: 'flex', marginBottom: 16 }}>
          <Button variant="primary" style={{ marginLeft: 'auto' }}
            onClick={() => { setAdmitting((v) => !v); setOpenStay(null); }}>
            {admitting ? 'Fermer' : '+ Nouvelle admission'}
          </Button>
        </div>

        {admitting && <><AdmissionForm onDone={() => setAdmitting(false)} /><div style={{ height: 16 }} /></>}
        {openStay && <><StayDetailPanel stayId={openStay} onClose={() => setOpenStay(null)} /><div style={{ height: 16 }} /></>}

        <Panel>
          <PanelHeader>Patients hospitalisés{stays.length ? ` (${stays.length})` : ''}</PanelHeader>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>}
            {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
            {!isLoading && stays.length === 0 && (
              <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Aucun patient hospitalisé.</div>
            )}
            {stays.map((s) => (
              <StayRow key={s.stayId} stay={s} onOpen={() => { setOpenStay(s.stayId); setAdmitting(false); }} />
            ))}
          </div>
        </Panel>
      </div>
    </Screen>
  );
}
