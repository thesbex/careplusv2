/**
 * PreviousVitalsCard — right-side reference panel showing normal ranges
 * for the current patient demographic.
 *
 * Ported verbatim from the right-column content in
 * design/prototype/screens/prise-constantes.jsx:
 *   - Patient avatar + name + meta
 *   - "Repères (H 30-50 ans)" panel with reference rows
 *   - Amber warning callout
 *   - Action buttons (Envoyer en consultation / Enregistrer et remettre)
 *   - Footer "Saisi par …"
 */
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Warn } from '@/components/icons';
import { REFERENCE_RANGES } from '../fixtures';
import { useAuthStore } from '@/lib/auth/authStore';

interface PreviousVitalsCardProps {
  /**
   * Real patient identity. REQUIRED — historically this card fell back to a
   * Youssef Ziani fixture when the patient query failed, which let the medic
   * record vitals while looking at the wrong patient's reference data
   * (audit 2026-05-01, IHM QA). Caller must guarantee the patient is loaded
   * before mounting this card.
   */
  patient: { initials: string; fullName: string; meta: string };
  /** Show amber warning callout (TA élevée). */
  showTaWarn?: boolean;
  /** Called when "Envoyer en consultation" is clicked. */
  onSendToConsult?: () => void;
  /** Called when "Enregistrer et remettre en attente" is clicked. */
  onSaveAndWait?: () => void;
  /** Disable action buttons while submitting. */
  submitting?: boolean;
}

function formatRecordedBy(user: { firstName: string; lastName: string; roles: string[] } | null): string {
  if (!user) return 'utilisateur · ' + new Date().toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', hour12: false });
  const ROLE_LABELS: Record<string, string> = {
    MEDECIN: 'Médecin',
    ADMIN: 'Administrateur',
    ASSISTANT: 'Assistant(e)',
    SECRETAIRE: 'Secrétaire',
  };
  const ROLE_PRIORITY = ['MEDECIN', 'ADMIN', 'ASSISTANT', 'SECRETAIRE'];
  const code = ROLE_PRIORITY.find((r) => user.roles.includes(r)) ?? user.roles[0] ?? '';
  const role = ROLE_LABELS[code] ?? '—';
  const time = new Date().toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${user.firstName} ${user.lastName} · ${role} · ${time}`;
}

export function PreviousVitalsCard({
  patient,
  showTaWarn = true,
  onSendToConsult,
  onSaveAndWait,
  submitting = false,
}: PreviousVitalsCardProps) {
  const sessionUser = useAuthStore((s) => s.user);
  const recordedBy = formatRecordedBy(sessionUser);
  return (
    <>
      {/* Patient identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <Avatar initials={patient.initials} size="lg" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{patient.fullName}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{patient.meta}</div>
        </div>
      </div>

      {/* Reference ranges panel */}
      <Panel style={{ marginBottom: 12 }}>
        <PanelHeader>Repères (H 30-50 ans)</PanelHeader>
        <div style={{ padding: '10px 14px', fontSize: 12 }}>
          {REFERENCE_RANGES.map((r) => (
            <div
              key={r.label}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '3px 0',
              }}
            >
              <span style={{ color: 'var(--ink-3)' }}>{r.label}</span>
              <span className="tnum">
                {r.value}
                {r.unit ? ` ${r.unit}` : ''}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      {/* Amber warning callout */}
      {showTaWarn && (
        <div
          style={{
            padding: 12,
            background: 'var(--amber-soft)',
            borderRadius: 6,
            border: '1px solid #E8CFA9',
            fontSize: 12,
            color: 'var(--ink-2)',
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              fontWeight: 600,
              color: 'var(--amber)',
              marginBottom: 4,
            }}
          >
            <Warn /> TA légèrement élevée
          </div>
          Le patient sera orienté en consultation. Le médecin en sera informé.
        </div>
      )}

      {/* Actions */}
      <Button
        variant="primary"
        size="lg"
        style={{ width: '100%', justifyContent: 'center' }}
        onClick={onSendToConsult}
        disabled={submitting}
        type="submit"
      >
        Envoyer en consultation →
      </Button>
      <Button
        style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
        onClick={onSaveAndWait}
        disabled={submitting}
        type="button"
      >
        Enregistrer et remettre en attente
      </Button>

      {/* Footer */}
      <div
        style={{
          fontSize: 11,
          color: 'var(--ink-3)',
          textAlign: 'center',
          marginTop: 10,
        }}
      >
        Saisi par {recordedBy}
      </div>
    </>
  );
}
