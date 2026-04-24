/**
 * Left panel: patient at a glance.
 * Ported verbatim from the left column in EcranConsultation (screens/consultation.jsx).
 * Shows avatar, name/age/sex/dossierNo, allergy pill, conditions pill, vitals panel,
 * current medications, and last follow-up notes.
 */
import { Panel } from '@/components/ui/Panel';
import { Warn } from '@/components/icons';
import type { ConsultationPatient } from '../types';

interface PatientContextCardProps {
  patient: ConsultationPatient;
}

export function PatientContextCard({ patient }: PatientContextCardProps) {
  return (
    <div
      style={{
        borderRight: '1px solid var(--border)',
        background: 'var(--surface-2)',
        padding: 16,
        overflow: 'auto',
      }}
      className="scroll"
    >
      <div className="cp-avatar lg" style={{ marginBottom: 10 }} aria-hidden="true">
        {patient.initials}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>
        {patient.fullName}
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
        {patient.age} ans · {patient.sex} · {patient.dossierNo}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          marginTop: 10,
          marginBottom: 14,
        }}
      >
        <span className="pill allergy">
          <Warn aria-hidden="true" /> Allergie : {patient.allergy}
        </span>
        <span className="pill">{patient.conditions}</span>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          marginBottom: 6,
        }}
      >
        Constantes {patient.vitalsTime}
      </div>
      <Panel style={{ marginBottom: 14 }}>
        <div style={{ padding: '10px 12px', fontSize: 12 }}>
          {patient.vitals.map(({ k, v, warn }) => (
            <div
              key={k}
              style={{ display: 'flex', justifyContent: 'space-between' }}
            >
              <span style={{ color: 'var(--ink-3)' }}>{k}</span>
              <span
                className="tnum"
                style={warn ? { color: 'var(--amber)', fontWeight: 600 } : undefined}
              >
                {v}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          marginBottom: 6,
        }}
      >
        Traitement en cours
      </div>
      <div style={{ fontSize: 12 }}>
        {patient.currentMedications.map((med, i) => (
          <div
            key={med.name}
            style={{
              padding: '6px 0',
              borderBottom:
                i < patient.currentMedications.length - 1
                  ? '1px dashed var(--border)'
                  : undefined,
            }}
          >
            <div style={{ fontWeight: 550 }}>{med.name}</div>
            <div style={{ color: 'var(--ink-3)', fontSize: 11 }}>
              {med.posology} · {med.since}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-3)',
          marginTop: 16,
          marginBottom: 6,
        }}
      >
        Dernier suivi
      </div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
        {patient.followUps.map((f, i) => (
          <div key={i} style={i > 0 ? { marginTop: 6 } : undefined}>
            {f.date} — {f.note}
          </div>
        ))}
      </div>
    </div>
  );
}
