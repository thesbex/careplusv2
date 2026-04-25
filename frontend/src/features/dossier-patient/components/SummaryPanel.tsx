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

const SEVERITY_BG: Record<string, { bg: string; color: string; border: string }> = {
  LEGERE: { bg: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
  MODEREE: { bg: '#FFF8E1', color: '#E65100', border: '#FFCC80' },
  SEVERE: { bg: '#FFEBEE', color: 'var(--danger)', border: '#EF9A9A' },
};

const ANTECEDENT_LABELS: Record<string, string> = {
  MEDICAL: 'Médical',
  CHIRURGICAL: 'Chirurgical',
  FAMILIAL: 'Familial',
  GYNECO_OBSTETRIQUE: 'Gynéco',
  HABITUS: 'Habitudes',
  TRAITEMENT_CHRONIQUE: 'Traitement',
};

export function SummaryPanel({ patient }: SummaryPanelProps) {
  const allergies = patient.allergyDetails ?? [];
  const antecedents = patient.antecedentDetails ?? [];
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
      {/* Allergies */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Allergies</PanelHeader>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {allergies.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucune allergie connue.</div>
          )}
          {allergies.map((a) => {
            const sev = SEVERITY_BG[a.severity] ?? SEVERITY_BG.MODEREE!;
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                }}
              >
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 550 }}>{a.substance}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: sev.bg,
                    color: sev.color,
                    border: `1px solid ${sev.border}`,
                    fontWeight: 600,
                  }}
                >
                  {a.severity === 'LEGERE'
                    ? 'Légère'
                    : a.severity === 'SEVERE'
                    ? 'Sévère'
                    : 'Modérée'}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Antécédents */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Antécédents</PanelHeader>
        <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {antecedents.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Aucun antécédent.</div>
          )}
          {antecedents.map((a) => (
            <div
              key={a.id}
              style={{
                padding: '6px 10px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 650,
                  color: 'var(--primary)',
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  marginBottom: 2,
                }}
              >
                {ANTECEDENT_LABELS[a.type] ?? a.type}
              </div>
              <div style={{ fontSize: 12.5 }}>{a.description}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Mutuelle */}
      {(patient.mutuelleInsuranceId || patient.tier === 'PREMIUM') && (
        <Panel style={{ marginBottom: 12 }}>
          <PanelHeader>Couverture</PanelHeader>
          <div style={{ padding: '10px 14px', fontSize: 12.5 }}>
            {patient.tier === 'PREMIUM' && (
              <div style={{ marginBottom: 4 }}>🌟 Patient Premium (remise auto)</div>
            )}
            {patient.mutuelleInsuranceId && (
              <div style={{ color: 'var(--ink-2)' }}>
                Mutuelle{' '}
                {patient.mutuellePolicyNumber ? `· N° ${patient.mutuellePolicyNumber}` : ''}
              </div>
            )}
          </div>
        </Panel>
      )}

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
