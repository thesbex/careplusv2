/**
 * QueueRow — one patient row in the queue table.
 * Ported from design/prototype/screens/salle-attente.jsx:55–86.
 *
 * Renders: avatar, name + allergy chip, age+reason meta,
 * scheduled/arrived times, wait time (amber if ≥25 min),
 * status pill with dot, room label, CTA button.
 */
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Pill';
import { MoreH, Warn } from '@/components/icons';
import type { QueueEntry, WaitingPatientStatus } from '../types';

const STATUS_LABEL: Record<WaitingPatientStatus, string> = {
  consult:  'En consultation',
  vitals:   'En constantes',
  waiting:  'En attente',
  arrived:  'Arrivé',
  done:     'Terminé',
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
}

export function QueueRow({ patient: p }: QueueRowProps) {
  const waitedAmber = p.waited.includes('25');

  return (
    <tr className="sa-queue-row">
      {/* Patient cell */}
      <td className="sa-td sa-td-patient">
        <div className="sa-patient-cell">
          <Avatar initials={initials(p.name)} size="sm" />
          <div>
            <div className="sa-patient-name">
              {p.name}
              {p.allergy && (
                <Pill status="allergy" className="sa-allergy-chip">
                  <Warn /> {p.allergy}
                </Pill>
              )}
            </div>
            <div className="sa-patient-meta">
              {p.age} ans · {p.reason}
            </div>
          </div>
        </div>
      </td>

      {/* RDV */}
      <td className="sa-td tnum">{p.apt}</td>

      {/* Arrivé à */}
      <td className="sa-td tnum">{p.arrived}</td>

      {/* Attente */}
      <td
        className="sa-td tnum"
        style={{
          color: waitedAmber ? 'var(--amber)' : 'var(--ink-2)',
          fontWeight: waitedAmber ? 600 : 400,
        }}
      >
        {p.waited}
      </td>

      {/* Motif */}
      <td className="sa-td sa-td-motif">{p.reason}</td>

      {/* Statut */}
      <td className="sa-td">
        <Pill status={p.status} dot>
          {STATUS_LABEL[p.status]}
        </Pill>
      </td>

      {/* Box */}
      <td className="sa-td sa-td-box">{p.room}</td>

      {/* Actions */}
      <td className="sa-td sa-td-actions">
        <div className="sa-actions-group">
          {p.status === 'arrived' && (
            <Button size="sm" variant="primary">
              Prendre constantes →
            </Button>
          )}
          {p.status === 'vitals' && (
            <Button size="sm">Envoyer en consult. →</Button>
          )}
          {p.status === 'waiting' && (
            <Button size="sm">Appeler</Button>
          )}
          <Button size="sm" variant="ghost" iconOnly aria-label="Plus d'options">
            <MoreH />
          </Button>
        </div>
      </td>
    </tr>
  );
}
