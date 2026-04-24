/**
 * Screen 06 — Consultation (SOAP) mobile.
 * Ported verbatim from design/prototype/mobile/screens.jsx (MConsultation).
 *
 * Layout: MScreen with noTabs, patient context strip, vitals grid 4-col,
 * SOAP accordion (native details/summary, all open by default per prototype),
 * Rx + Clôturer action row.
 *
 * @radix-ui/react-accordion is NOT in package.json.
 * Using native buttons with aria-expanded + role="region" (same semantics, zero deps).
 * TODO(backend:J5): swap useConsultation to real data.
 */
import { useNavigate } from 'react-router-dom';
import { MScreen } from '@/components/shell/MScreen';
import { MTopbar, MIconBtn } from '@/components/shell/MTopbar';
import type { MobileTab } from '@/components/shell/MTabs';
import { Warn, Pill as PillIcon } from '@/components/icons';
import { SoapAccordion } from './components/SoapAccordion';
import { MOBILE_SOAP_SECTIONS, MOBILE_VITALS } from './fixtures';
import './consultation.css';

export default function ConsultationMobilePage() {
  const navigate = useNavigate();

  return (
    <MScreen
      tab="agenda"
      noTabs
      onTabChange={(t: MobileTab) => {
        const map: Record<MobileTab, string> = {
          agenda: '/agenda',
          salle: '/salle',
          patients: '/patients',
          factu: '/facturation',
          menu: '/parametres',
        };
        navigate(map[t]);
      }}
      topbar={
        <MTopbar
          left={<MIconBtn icon="ChevronLeft" label="Retour" onClick={() => navigate(-1)} />}
          title="Consultation"
          sub="Mohamed Alami · 09:12"
          right={<MIconBtn icon="MoreH" label="Plus d'actions" />}
        />
      }
    >
      {/* Patient context strip */}
      <div
        style={{
          background: 'var(--primary-soft)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--primary)',
            color: 'white',
            display: 'grid',
            placeItems: 'center',
            fontSize: 11,
            fontWeight: 600,
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          MA
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Mohamed Alami</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>H · 58 ans · HTA · TA 135/85</div>
        </div>
        <span className="m-pill allergy">
          <Warn aria-hidden="true" /> Pénicilline
        </span>
      </div>

      <div className="mb-pad">
        {/* Vitals recap grid */}
        <div className="cs-m-vitals-grid" role="region" aria-label="Constantes">
          {MOBILE_VITALS.map(([k, v]) => (
            <div key={k} className="cs-m-vital-cell">
              <div className="cs-m-vital-k">{k}</div>
              <div className="cs-m-vital-v">{v}</div>
            </div>
          ))}
        </div>

        {/* SOAP accordion */}
        <SoapAccordion sections={MOBILE_SOAP_SECTIONS} />

        {/* Action row */}
        <div className="cs-m-action-row">
          <button
            type="button"
            className="m-btn"
            style={{ height: 44 }}
            aria-label="Prescription"
          >
            <PillIcon aria-hidden="true" /> Rx
          </button>
          <button
            type="button"
            className="m-btn primary"
            style={{ height: 44 }}
            aria-label="Clôturer la consultation"
          >
            Clôturer
          </button>
        </div>
      </div>
    </MScreen>
  );
}
