/**
 * PatientHeader — avatar + name + age + CIN + allergy pills.
 * Ported from design/prototype/screens/dossier-patient.jsx lines 20–44.
 */
import { Avatar } from '@/components/ui/Avatar';
import { Pill } from '@/components/ui/Pill';
import { Button } from '@/components/ui/Button';
import { Print, Edit, Plus, Warn } from '@/components/icons';
import type { PatientSummary } from '../types';

interface PatientHeaderProps {
  patient: PatientSummary;
  onEdit?: () => void;
  onNewConsultation?: () => void;
  isStartingConsult?: boolean;
}

export function PatientHeader({
  patient,
  onEdit,
  onNewConsultation,
  isStartingConsult,
}: PatientHeaderProps) {
  return (
    <div
      style={{
        padding: '16px 20px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <Avatar
        initials={patient.initials}
        size="lg"
        style={{ background: 'var(--primary)' }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em' }}>
            {patient.fullName}
          </div>
          <Pill>
            ♂ {patient.sex} · {patient.age} ans
          </Pill>
          <Pill>CIN {patient.cin}</Pill>
        </div>
        <div
          className="tnum"
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 12,
            color: 'var(--ink-3)',
            marginTop: 6,
          }}
        >
          <span>Né le {patient.birthDate}</span>
          <span>{patient.phone}</span>
          <span>{patient.email}</span>
          <span>Groupe {patient.bloodGroup}</span>
          <span>{patient.insurance}</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button>
          <Print /> Imprimer
        </Button>
        <Button onClick={onEdit}>
          <Edit /> Modifier
        </Button>
        <Button
          variant="primary"
          onClick={onNewConsultation}
          disabled={!onNewConsultation || isStartingConsult}
        >
          <Plus /> {isStartingConsult ? 'Démarrage…' : 'Nouvelle consultation'}
        </Button>
      </div>

      {/* Alerts strip */}
      <div
        style={{
          display: 'none',
        }}
        aria-hidden="true"
      />
    </div>
  );
}

interface AllergyStripProps {
  patient: PatientSummary;
}

export function AllergyStrip({ patient }: AllergyStripProps) {
  return (
    <div
      style={{
        padding: '10px 20px',
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        background: 'var(--amber-soft)',
        borderBottom: '1px solid #E8CFA9',
      }}
      role="alert"
      aria-label="Allergie connue"
    >
      <div
        style={{
          color: 'var(--amber)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 600,
          fontSize: 12,
        }}
      >
        <Warn aria-hidden="true" /> Allergie
      </div>
      <span style={{ fontSize: 12.5, color: 'var(--ink)' }}>
        {(patient.allergyNotes.split('(')[0] ?? '').trim()}{' '}
        {patient.allergyNotes.includes('(') && (
          <span style={{ color: 'var(--ink-3)' }}>
            ({patient.allergyNotes.split('(')[1] ?? ''}
          </span>
        )}
      </span>
      <div
        style={{ width: 1, height: 16, background: '#E8CFA9', margin: '0 8px' }}
        aria-hidden="true"
      />
      <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
        <span>
          <strong>ATCD :</strong> {patient.antecedents}
        </span>
        <span style={{ color: 'var(--ink-3)' }}>·</span>
        <span>
          <strong>Traitement chronique :</strong> {patient.chronicTreatment}
        </span>
      </div>
    </div>
  );
}
