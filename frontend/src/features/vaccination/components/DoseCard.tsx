/**
 * DoseCard — shared card for a single vaccine dose.
 * Rendered inside VaccinationCalendarTab (desktop) and VaccinationCalendarTab.mobile.tsx.
 * Colors and patterns follow design/prototype/DESIGN_SYSTEM.md §2 tokens.
 */
import { Edit, Trash } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import type { VaccinationCalendarEntry, DoseStatus, DrawerMode } from '../types';

interface DoseCardProps {
  dose: VaccinationCalendarEntry;
  canRecord: boolean; // MEDECIN | ASSISTANT | ADMIN
  canAdmin: boolean;  // MEDECIN | ADMIN
  onRecord: (dose: VaccinationCalendarEntry, mode: DrawerMode) => void;
  onDefer: (dose: VaccinationCalendarEntry) => void;
  onSkip: (dose: VaccinationCalendarEntry) => void;
  onDelete: (dose: VaccinationCalendarEntry) => void;
}

const STATUS_STYLE: Record<DoseStatus, { bg: string; border: string; color: string; label: string }> = {
  ADMINISTERED: {
    bg: 'var(--success-soft)',
    border: 'var(--success)',
    color: 'var(--success)',
    label: 'Administrée',
  },
  DUE_SOON: {
    bg: 'var(--amber-soft)',
    border: 'var(--amber)',
    color: 'var(--amber)',
    label: 'Prochaine',
  },
  OVERDUE: {
    bg: 'var(--danger-soft)',
    border: 'var(--danger)',
    color: 'var(--danger)',
    label: 'En retard',
  },
  UPCOMING: {
    bg: 'var(--surface)',
    border: 'var(--border)',
    color: 'var(--ink-3)',
    label: 'Planifiée',
  },
  SKIPPED: {
    bg: 'var(--bg-alt)',
    border: 'var(--border)',
    color: 'var(--ink-4)',
    label: 'Non administrée',
  },
  DEFERRED: {
    bg: 'var(--bg-alt)',
    border: 'var(--border-strong)',
    color: 'var(--ink-2)',
    label: 'Reportée',
  },
};

function formatDateFR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateTimeFR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('fr-MA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DoseCard({
  dose,
  canRecord,
  canAdmin,
  onRecord,
  onDefer,
  onSkip,
  onDelete,
}: DoseCardProps) {
  const style = STATUS_STYLE[dose.status];
  const isActionable = dose.status === 'UPCOMING' || dose.status === 'DUE_SOON' || dose.status === 'OVERDUE';
  const isAdministered = dose.status === 'ADMINISTERED';
  const isSkipped = dose.status === 'SKIPPED';
  const isDeferred = dose.status === 'DEFERRED';

  return (
    <div
      data-testid={`dose-card-${dose.vaccineCode}-${dose.doseNumber}`}
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 'var(--r-md)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        opacity: isSkipped ? 0.65 : 1,
        ...(isSkipped
          ? {
              background: `repeating-linear-gradient(
                -45deg,
                var(--bg-alt),
                var(--bg-alt) 4px,
                var(--border) 4px,
                var(--border) 5px
              )`,
            }
          : {}),
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--ink)',
              textDecoration: isSkipped ? 'line-through' : 'none',
              lineHeight: 1.3,
            }}
          >
            {dose.vaccineName}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 2 }}>
            {dose.doseLabel}
            {' · '}
            <span className="tnum">{formatDateFR(dose.targetDate)}</span>
          </div>
        </div>

        {/* Status badge */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 'var(--r-sm)',
            background: style.bg,
            color: style.color,
            border: `1px solid ${style.border}`,
            flexShrink: 0,
          }}
        >
          {style.label}
        </span>
      </div>

      {/* Administered details */}
      {isAdministered && (
        <div style={{ fontSize: 12, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {dose.administeredAt && (
            <div>
              <span style={{ color: 'var(--ink-3)' }}>Le </span>
              <span className="tnum">{formatDateTimeFR(dose.administeredAt)}</span>
            </div>
          )}
          {dose.lotNumber && (
            <div>
              <span style={{ color: 'var(--ink-3)' }}>Lot </span>
              <span className="mono">{dose.lotNumber}</span>
            </div>
          )}
          {dose.administeredByName && (
            <div>
              <span style={{ color: 'var(--ink-3)' }}>Par </span>
              {dose.administeredByName}
            </div>
          )}
        </div>
      )}

      {/* Deferral reason — shown as tooltip text */}
      {isDeferred && dose.deferralReason && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--amber)',
            background: 'var(--amber-soft)',
            border: '1px solid var(--amber)',
            borderRadius: 'var(--r-sm)',
            padding: '4px 8px',
            lineHeight: 1.4,
          }}
          title={dose.deferralReason}
        >
          Motif : {dose.deferralReason}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {isActionable && canRecord && (
          <Button
            size="sm"
            variant="primary"
            onClick={() => onRecord(dose, 'record')}
            style={{ fontSize: 12 }}
          >
            Saisir dose
          </Button>
        )}
        {isActionable && canRecord && (
          <Button
            size="sm"
            onClick={() => onDefer(dose)}
            style={{ fontSize: 12 }}
          >
            Reporter
          </Button>
        )}
        {isActionable && canAdmin && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onSkip(dose)}
            style={{ fontSize: 12, color: 'var(--ink-3)' }}
          >
            Non administrée
          </Button>
        )}
        {isAdministered && canAdmin && (
          <Button
            size="sm"
            onClick={() => onRecord(dose, 'edit')}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Edit style={{ width: 12, height: 12 }} /> Modifier
          </Button>
        )}
        {isAdministered && canAdmin && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => onDelete(dose)}
            style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Trash style={{ width: 12, height: 12 }} /> Supprimer
          </Button>
        )}
        {(isAdministered) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onRecord(dose, 'view')}
            style={{ fontSize: 12 }}
          >
            Voir
          </Button>
        )}
      </div>
    </div>
  );
}
