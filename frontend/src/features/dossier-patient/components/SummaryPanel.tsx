/**
 * SummaryPanel — right column with vitals, medications, admin cards.
 * Ported from design/prototype/screens/dossier-patient.jsx lines 133–154
 * (SummaryCard, KV, Med helpers).
 */
import { Panel, PanelHeader } from '@/components/ui/Panel';
import type { PatientSummary } from '../types';

interface SummaryPanelProps {
  patient: PatientSummary;
}

export function SummaryPanel({ patient }: SummaryPanelProps) {
  return (
    <div
      className="scroll"
      style={{
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface-2)',
        overflow: 'auto',
        padding: 16,
      }}
    >
      {/* Constantes card */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader style={{ display: 'flex' }}>
          <span>Constantes — dernière visite</span>
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 400,
              fontSize: 11,
              color: 'var(--ink-3)',
            }}
          >
            {patient.lastVitalsDate}
          </span>
        </PanelHeader>
        <div style={{ padding: '10px 14px' }}>
          {patient.lastVitals.map((v) => (
            <div
              key={v.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '3px 0',
                fontSize: 12.5,
              }}
            >
              <span style={{ color: 'var(--ink-3)' }}>{v.k}</span>
              <span
                className="tnum"
                style={{
                  fontWeight: 550,
                  color: v.warn ? 'var(--amber)' : 'var(--ink)',
                }}
              >
                {v.v}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Traitement card */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader style={{ display: 'flex' }}>
          <span>Traitement en cours</span>
          <span
            style={{
              marginLeft: 'auto',
              fontWeight: 400,
              fontSize: 11,
              color: 'var(--ink-3)',
            }}
          >
            {patient.currentMedicationsSince}
          </span>
        </PanelHeader>
        <div style={{ padding: '10px 14px' }}>
          {patient.currentMedications.map((m) => (
            <div
              key={m.name}
              style={{
                padding: '6px 0',
                borderBottom: '1px dashed var(--border)',
              }}
            >
              <div style={{ fontWeight: 550, fontSize: 12.5 }}>{m.name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{m.posology}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Consentements card */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Consentements &amp; administratif</PanelHeader>
        <div style={{ padding: '10px 14px' }}>
          {patient.admin.map((a) => (
            <div
              key={a.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '3px 0',
                fontSize: 12.5,
              }}
            >
              <span style={{ color: 'var(--ink-3)' }}>{a.k}</span>
              <span className="tnum" style={{ fontWeight: 550, color: 'var(--ink)' }}>
                {a.v}
              </span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
