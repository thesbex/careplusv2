/**
 * QueueRow — one patient row in the queue table.
 * CTAs dispatch callbacks to the parent page which owns the mutations
 * (check-in, start-consultation) and the navigation to /constantes.
 */
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { MoreH, Warn } from '@/components/icons';
import type { QueueEntry, WaitingPatientStatus } from '../types';

const STATUS_LABEL: Record<WaitingPatientStatus, string> = {
  consult: 'En consultation',
  vitals: 'En constantes',
  waiting: 'En attente',
  arrived: 'Arrivé',
  done: 'Terminé',
};

function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('');
}

interface QueueRowProps {
  patient: QueueEntry;
  onTakeVitals?: (appointmentId: string) => void;
  onStartConsult?: (entry: QueueEntry) => void;
  onOpenConsult?: (entry: QueueEntry) => void;
  busy?: boolean;
}

export function QueueRow({
  patient: p,
  onTakeVitals,
  onStartConsult,
  onOpenConsult,
  busy,
}: QueueRowProps) {
  const waitedAmber = p.waited.includes('25');

  return (
    <tr className="sa-queue-row">
      <td className="sa-td sa-td-patient">
        <div className="sa-patient-cell">
          <Avatar initials={initials(p.name)} size="sm" />
          <div>
            <div className="sa-patient-name">
              {p.isPremium && (
                <span title="Patient Premium" aria-label="Patient Premium" style={{ marginRight: 4 }}>
                  🌟
                </span>
              )}
              {p.name}
              {p.allergy && (
                <Pill status="allergy" className="sa-allergy-chip">
                  <Warn /> {p.allergy}
                </Pill>
              )}
            </div>
            <div className="sa-patient-meta">
              {p.age > 0 ? `${p.age} ans` : ''}
              {p.age > 0 && p.reason ? ' · ' : ''}
              {p.reason}
              {!p.age && !p.reason && '—'}
            </div>
          </div>
        </div>
      </td>

      <td className="sa-td tnum">
        {p.apt}
        {p.durationMinutes ? (
          <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginLeft: 4 }}>
            ({p.durationMinutes}min)
          </span>
        ) : null}
      </td>
      <td className="sa-td tnum">{p.arrived}</td>

      <td
        className="sa-td tnum"
        style={{
          color: waitedAmber ? 'var(--amber)' : 'var(--ink-2)',
          fontWeight: waitedAmber ? 600 : 400,
        }}
      >
        {p.waited}
      </td>

      <td className="sa-td sa-td-motif">{p.reason || '—'}</td>

      <td className="sa-td">
        <Pill status={p.status} dot>
          {STATUS_LABEL[p.status]}
        </Pill>
      </td>

      <td className="sa-td sa-td-box">{p.room}</td>

      <td className="sa-td sa-td-actions">
        <div className="sa-actions-group">
          {p.status === 'arrived' && p.appointmentId && (
            <Button
              size="sm"
              variant="primary"
              disabled={busy}
              onClick={() => onTakeVitals?.(p.appointmentId!)}
            >
              Prendre constantes →
            </Button>
          )}
          {p.status === 'vitals' && p.patientId && (
            <Button size="sm" disabled={busy} onClick={() => onStartConsult?.(p)}>
              Envoyer en consult. →
            </Button>
          )}
          {p.status === 'consult' && (
            <Button size="sm" onClick={() => onOpenConsult?.(p)}>
              Ouvrir
            </Button>
          )}
          {p.status === 'waiting' && <Button size="sm">Appeler</Button>}
          <Button size="sm" variant="ghost" iconOnly aria-label="Plus d'options">
            <MoreH />
          </Button>
        </div>
      </td>
    </tr>
  );
}
