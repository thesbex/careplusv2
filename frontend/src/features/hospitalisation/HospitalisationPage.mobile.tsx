/**
 * « Patients hospitalisés » (mobile 390 px) — worklist + admission + détail séjour.
 * Réutilise les panneaux partagés (parité desktop).
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { AdmissionForm, StayDetailPanel } from './components/StayPanels';
import { useStayQueue } from './hooks/useStays';

const TAB_MAP: Record<MobileTab, string> = {
  agenda: '/agenda', salle: '/salle', patients: '/patients', factu: '/facturation', menu: '/parametres',
};

export default function HospitalisationPageMobile() {
  const navigate = useNavigate();
  const { stays, isLoading } = useStayQueue();
  const [admitting, setAdmitting] = useState(false);
  const [openStay, setOpenStay] = useState<string | null>(null);

  return (
    <MScreen
      tab="menu"
      onTabChange={(t) => navigate(TAB_MAP[t])}
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate('/parametres')} />}
          title="Hospitalisation"
          sub={`${stays.length} patient${stays.length !== 1 ? 's' : ''}`}
          right={
            <button type="button" onClick={() => { setAdmitting((v) => !v); setOpenStay(null); }}
              aria-label="Nouvelle admission"
              style={{ background: 'var(--primary)', border: 'none', borderRadius: 'var(--r-sm)', color: 'white',
                padding: '6px 12px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>
              {admitting ? 'Fermer' : '+ Admettre'}
            </button>
          }
        />
      }
    >
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {admitting && <AdmissionForm onDone={() => setAdmitting(false)} />}
        {openStay && <StayDetailPanel stayId={openStay} onClose={() => setOpenStay(null)} />}

        {isLoading && <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Chargement…</div>}
        {!isLoading && stays.length === 0 && (
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Aucun patient hospitalisé.</div>
        )}
        {stays.map((s) => (
          <button key={s.stayId} type="button" data-testid={`stay-card-${s.stayId}`}
            onClick={() => { setOpenStay(s.stayId); setAdmitting(false); }}
            style={{ textAlign: 'left', background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 8, padding: 12, cursor: 'pointer' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>{s.patientLastName} {s.patientFirstName}</div>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
              {s.bedLabel ?? '—'}{s.wardLabel ? ` · ${s.wardLabel}` : ''} · Jour {s.daysSoFar}
            </div>
            {s.admissionReason && (
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>{s.admissionReason}</div>
            )}
          </button>
        ))}
      </div>
    </MScreen>
  );
}
